import { supabase } from '$lib/supabase';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export const load: PageServerLoad = async () => {
  const [{ data: attrsRaw }, { data: chauffeursRaw }, { data: modelesRaw }] = await Promise.all([
    supabase
      .from('attribution')
      .select(
        `id_attribution, id_chauffeur, id_epi, date_attribution, date_retour, motif_retour, etat_epi,
         chauffeur(id_chauffeur, prenom, nom, activite),
         epi(id_epi, statut, date_expiration, id_modele_epi, modele_epi(designation, type, taille))`,
      )
      .order('date_attribution', { ascending: false })
      .order('id_attribution', { ascending: false }),
    supabase.from('chauffeur').select('id_chauffeur, prenom, nom').order('nom'),
    supabase
      .from('modele_epi')
      .select('id_modele_epi, designation, type, taille, stock_total')
      .order('designation'),
  ]);

  const attributions = (attrsRaw ?? []).map((a) => {
    const ch = first(a.chauffeur);
    const epi = first(a.epi);
    const modele = first(epi?.modele_epi);
    return {
      id_attribution: a.id_attribution,
      id_chauffeur: a.id_chauffeur,
      id_epi: a.id_epi,
      id_modele_epi: (epi?.id_modele_epi ?? '') as string,
      date_attribution: a.date_attribution,
      date_retour: (a.date_retour ?? null) as string | null,
      motif_retour: (a.motif_retour ?? null) as string | null,
      etat_epi: (a.etat_epi ?? null) as string | null,
      chauffeur_prenom: ch?.prenom ?? '',
      chauffeur_nom: ch?.nom ?? '',
      chauffeur_activite: (ch?.activite ?? null) as string | null,
      epi_statut: epi?.statut ?? '—',
      epi_date_expiration: (epi?.date_expiration ?? null) as string | null,
      designation: modele?.designation ?? '—',
      type: modele?.type ?? '—',
      taille: (modele?.taille ?? null) as string | null,
    };
  });

  // stock_dispo = stock_total - nombre d'attributions actives pour ce modèle
  const attribueByModele: Record<string, number> = {};
  for (const a of attrsRaw ?? []) {
    if (a.date_retour) continue;
    const modeleId = first(a.epi)?.id_modele_epi as string | undefined;
    if (modeleId) attribueByModele[modeleId] = (attribueByModele[modeleId] ?? 0) + 1;
  }

  const episDisponibles = (modelesRaw ?? []).map((m) => ({
    id_modele_epi: m.id_modele_epi,
    designation: m.designation,
    type: m.type,
    taille: (m.taille ?? null) as string | null,
    stock_total: m.stock_total ?? 0,
    stock_dispo: (m.stock_total ?? 0) - (attribueByModele[m.id_modele_epi] ?? 0),
  }));

  const chauffeurs = (chauffeursRaw ?? []).map((c) => ({
    id_chauffeur: c.id_chauffeur,
    prenom: c.prenom,
    nom: c.nom,
  }));

  return { attributions, chauffeurs, episDisponibles };
};

export const actions: Actions = {
  creerAttribution: async ({ request }) => {
    const fd = await request.formData();
    const id_chauffeur = fd.get('id_chauffeur') as string;
    const ids_modele = (fd.getAll('id_modele_epi') as string[]).filter(Boolean);
    if (!id_chauffeur || ids_modele.length === 0)
      return fail(400, { error: 'Chauffeur et EPI requis' });

    const today = new Date().toISOString().split('T')[0];

    for (const id_modele_epi of ids_modele) {
      const { data: existingEpi } = await supabase
        .from('epi')
        .select('id_epi')
        .eq('id_modele_epi', id_modele_epi)
        .eq('statut', 'disponible')
        .limit(1)
        .maybeSingle();

      let id_epi: string;
      if (existingEpi) {
        id_epi = existingEpi.id_epi;
        await supabase.from('epi').update({ statut: 'attribué' }).eq('id_epi', id_epi);
      } else {
        const { data: newEpi, error: epiErr } = await supabase
          .from('epi')
          .insert({ id_modele_epi, statut: 'attribué' })
          .select('id_epi')
          .single();
        if (epiErr || !newEpi) return fail(500, { error: "Erreur lors de la création de l'EPI" });
        id_epi = newEpi.id_epi;
      }

      const { error } = await supabase
        .from('attribution')
        .insert({ id_chauffeur, id_epi, date_attribution: today });
      if (error) return fail(500, { error: "Erreur lors de la création de l'attribution" });
    }

    return { success: true };
  },

  updateAttribution: async ({ request }) => {
    const fd = await request.formData();
    const id_attribution = fd.get('id_attribution') as string;
    const id_chauffeur = fd.get('id_chauffeur') as string;
    const id_modele_epi = fd.get('id_modele_epi') as string;
    if (!id_attribution || !id_chauffeur || !id_modele_epi)
      return fail(400, { error: 'Données manquantes' });

    const { data: current } = await supabase
      .from('attribution')
      .select('id_epi, date_retour')
      .eq('id_attribution', id_attribution)
      .single();
    const oldEpiId = current?.id_epi as string | undefined;
    const isActive = current ? current.date_retour == null : false;

    let oldModeleId: string | undefined;
    if (oldEpiId) {
      const { data: oldEpi } = await supabase
        .from('epi')
        .select('id_modele_epi')
        .eq('id_epi', oldEpiId)
        .single();
      oldModeleId = oldEpi?.id_modele_epi as string | undefined;
    }

    if (oldModeleId === id_modele_epi) {
      const { error } = await supabase
        .from('attribution')
        .update({ id_chauffeur })
        .eq('id_attribution', id_attribution);
      if (error) return fail(500, { error: 'Erreur lors de la modification' });
      return { success: true };
    }

    const { data: availEpi } = await supabase
      .from('epi')
      .select('id_epi')
      .eq('id_modele_epi', id_modele_epi)
      .eq('statut', 'disponible')
      .limit(1)
      .maybeSingle();

    let newEpiId: string;
    if (availEpi) {
      newEpiId = availEpi.id_epi;
    } else {
      const { data: newEpi, error: epiErr } = await supabase
        .from('epi')
        .insert({ id_modele_epi, statut: 'attribué' })
        .select('id_epi')
        .single();
      if (epiErr || !newEpi) return fail(500, { error: "Erreur lors de la création de l'EPI" });
      newEpiId = newEpi.id_epi;
    }

    const { error } = await supabase
      .from('attribution')
      .update({ id_chauffeur, id_epi: newEpiId })
      .eq('id_attribution', id_attribution);
    if (error) return fail(500, { error: 'Erreur lors de la modification' });

    if (isActive) {
      if (oldEpiId) {
        await supabase.from('epi').update({ statut: 'disponible' }).eq('id_epi', oldEpiId);
      }
      if (availEpi) {
        await supabase.from('epi').update({ statut: 'attribué' }).eq('id_epi', newEpiId);
      }
    }

    return { success: true };
  },

  returnEpi: async ({ request }) => {
    const fd = await request.formData();
    const id_attribution = fd.get('id_attribution') as string;
    const id_epi = fd.get('id_epi') as string;
    const motif = (fd.get('motif_retour') as string | null)?.trim() || 'Retour';
    if (!id_attribution || !id_epi) return fail(400, { error: 'Données manquantes' });

    const today = new Date().toISOString().split('T')[0];
    await Promise.all([
      supabase
        .from('attribution')
        .update({ date_retour: today, motif_retour: motif })
        .eq('id_attribution', id_attribution),
      supabase.from('epi').update({ statut: 'disponible' }).eq('id_epi', id_epi),
    ]);
    return { success: true };
  },

  deleteAttribution: async ({ request }) => {
    const fd = await request.formData();
    const id_attribution = fd.get('id_attribution') as string;
    const id_epi = fd.get('id_epi') as string;
    if (!id_attribution) return fail(400, { error: 'ID manquant' });

    const { data: current } = await supabase
      .from('attribution')
      .select('date_retour')
      .eq('id_attribution', id_attribution)
      .single();
    const wasActive = current ? current.date_retour == null : false;

    const { error } = await supabase
      .from('attribution')
      .delete()
      .eq('id_attribution', id_attribution);
    if (error) return fail(500, { error: 'Erreur lors de la suppression' });

    if (wasActive && id_epi) {
      await supabase.from('epi').update({ statut: 'disponible' }).eq('id_epi', id_epi);
    }
    return { success: true };
  },
};
