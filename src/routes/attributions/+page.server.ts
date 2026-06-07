import { supabase } from '$lib/supabase';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

// Normalise une relation Supabase qui peut arriver sous forme d'objet ou de tableau.
function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export const load: PageServerLoad = async () => {
  const [{ data: attrsRaw }, { data: chauffeursRaw }, { data: episDispoRaw }] = await Promise.all([
    supabase
      .from('attribution')
      .select(
        `id_attribution, id_chauffeur, id_epi, date_attribution, date_retour, motif_retour, etat_epi,
         chauffeur(id_chauffeur, prenom, nom, activite),
         epi(id_epi, statut, date_expiration, modele_epi(id_modele_epi, designation, type, taille))`,
      )
      .order('date_attribution', { ascending: false }),
    supabase.from('chauffeur').select('id_chauffeur, prenom, nom').order('nom'),
    supabase
      .from('epi')
      .select('id_epi, statut, modele_epi(designation, type, taille)')
      .eq('statut', 'disponible'),
  ]);

  const attributions = (attrsRaw ?? []).map((a) => {
    const ch = first(a.chauffeur);
    const epi = first(a.epi);
    const modele = first(epi?.modele_epi);
    return {
      id_attribution: a.id_attribution,
      id_chauffeur: a.id_chauffeur,
      id_epi: a.id_epi,
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

  const chauffeurs = (chauffeursRaw ?? []).map((c) => ({
    id_chauffeur: c.id_chauffeur,
    prenom: c.prenom,
    nom: c.nom,
  }));

  const episDisponibles = (episDispoRaw ?? []).map((e) => {
    const modele = first(e.modele_epi);
    return {
      id_epi: e.id_epi,
      designation: modele?.designation ?? '—',
      type: modele?.type ?? '—',
      taille: (modele?.taille ?? null) as string | null,
    };
  });

  return { attributions, chauffeurs, episDisponibles };
};

export const actions: Actions = {
  // Crée une ou plusieurs attributions (un EPI par attribution) pour le même chauffeur.
  creerAttribution: async ({ request }) => {
    const fd = await request.formData();
    const id_chauffeur = fd.get('id_chauffeur') as string;
    const ids_epi = (fd.getAll('id_epi') as string[]).filter(Boolean);
    if (!id_chauffeur || ids_epi.length === 0)
      return fail(400, { error: 'Chauffeur et EPI requis' });

    const today = new Date().toISOString().split('T')[0];
    const rows = ids_epi.map((id_epi) => ({ id_chauffeur, id_epi, date_attribution: today }));
    const { error } = await supabase.from('attribution').insert(rows);
    if (error) return fail(500, { error: "Erreur lors de la création de l'attribution" });

    await Promise.all(
      ids_epi.map((id_epi) =>
        supabase.from('epi').update({ statut: 'attribué' }).eq('id_epi', id_epi),
      ),
    );
    return { success: true };
  },

  // Corrige une attribution : change le chauffeur et/ou l'EPI.
  updateAttribution: async ({ request }) => {
    const fd = await request.formData();
    const id_attribution = fd.get('id_attribution') as string;
    const id_chauffeur = fd.get('id_chauffeur') as string;
    const id_epi = fd.get('id_epi') as string;
    if (!id_attribution || !id_chauffeur || !id_epi)
      return fail(400, { error: 'Données manquantes' });

    const { data: current } = await supabase
      .from('attribution')
      .select('id_epi, date_retour')
      .eq('id_attribution', id_attribution)
      .single();
    const oldEpi = current?.id_epi as string | undefined;
    const isActive = current ? current.date_retour == null : false;

    const { error } = await supabase
      .from('attribution')
      .update({ id_chauffeur, id_epi })
      .eq('id_attribution', id_attribution);
    if (error) return fail(500, { error: 'Erreur lors de la modification' });

    // Si l'EPI change sur une attribution active, on réajuste les statuts.
    if (isActive && oldEpi && oldEpi !== id_epi) {
      await supabase.from('epi').update({ statut: 'disponible' }).eq('id_epi', oldEpi);
      await supabase.from('epi').update({ statut: 'attribué' }).eq('id_epi', id_epi);
    }
    return { success: true };
  },

  // Retourne l'EPI : clôture l'attribution + remet l'EPI disponible.
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

  // Supprime définitivement l'attribution (et libère l'EPI si elle était active).
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
