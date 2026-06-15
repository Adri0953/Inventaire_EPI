import { supabase } from '$lib/supabase';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const [
    { data: episRaw },
    { data: modeles },
    { data: chauffeurs },
    { data: allAttributions },
    { data: controles },
  ] = await Promise.all([
    supabase
      .from('epi')
      .select(
        'id_epi, statut, date_expiration, id_modele_epi, modele_epi(designation, type, taille)',
      )
      .order('id_epi'),
    supabase
      .from('modele_epi')
      .select('id_modele_epi, designation, type, taille')
      .order('designation'),
    supabase.from('chauffeur').select('id_chauffeur, prenom, nom').order('nom'),
    supabase
      .from('attribution')
      .select(
        'id_attribution, id_epi, id_chauffeur, date_attribution, date_retour, motif_retour, chauffeur(nom, prenom)',
      )
      .order('date_attribution', { ascending: false }),
    supabase
      .from('controle')
      .select('id_controle, id_epi, date_controle, prochain_controle, resultat')
      .order('date_controle', { ascending: false }),
  ]);

  type AttrRow = {
    id_attribution: string;
    id_chauffeur: string;
    chauffeur_nom: string;
    date_attribution: string;
    date_retour: string | null;
    motif_retour: string | null;
  };

  const attrByEpi: Record<string, AttrRow[]> = {};
  for (const a of allAttributions ?? []) {
    const ch = Array.isArray(a.chauffeur) ? a.chauffeur[0] : a.chauffeur;
    if (!attrByEpi[a.id_epi]) attrByEpi[a.id_epi] = [];
    attrByEpi[a.id_epi].push({
      id_attribution: a.id_attribution,
      id_chauffeur: a.id_chauffeur,
      chauffeur_nom: ch ? `${ch.prenom} ${ch.nom}` : 'Inconnu',
      date_attribution: a.date_attribution,
      date_retour: a.date_retour ?? null,
      motif_retour: a.motif_retour ?? null,
    });
  }

  type ControleRow = {
    id_controle: string;
    date_controle: string | null;
    prochain_controle: string | null;
    resultat: string | null;
  };

  const controlesByEpi: Record<string, ControleRow[]> = {};
  for (const c of controles ?? []) {
    if (!controlesByEpi[c.id_epi]) controlesByEpi[c.id_epi] = [];
    controlesByEpi[c.id_epi].push({
      id_controle: c.id_controle,
      date_controle: c.date_controle ?? null,
      prochain_controle: c.prochain_controle ?? null,
      resultat: c.resultat ?? null,
    });
  }

  const epis = (episRaw ?? []).map((e) => {
    const modele = Array.isArray(e.modele_epi) ? e.modele_epi[0] : e.modele_epi;
    const attrs = attrByEpi[e.id_epi] ?? [];
    return {
      id_epi: e.id_epi,
      statut: e.statut as 'disponible' | 'attribué' | 'hors_service',
      date_expiration: (e.date_expiration ?? null) as string | null,
      id_modele_epi: e.id_modele_epi as string,
      designation: modele?.designation ?? '—',
      type: modele?.type ?? '—',
      taille: (modele?.taille ?? null) as string | null,
      historique: attrs,
      controles: controlesByEpi[e.id_epi] ?? [],
    };
  });

  return { epis, modeles: modeles ?? [], chauffeurs: chauffeurs ?? [] };
};

export const actions: Actions = {
  supprimer_epi: async ({ request }) => {
    const fd = await request.formData();
    const id_epi = fd.get('id_epi') as string;
    if (!id_epi) return fail(400, { error: 'ID manquant' });

    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('attribution')
      .update({ date_retour: today, motif_retour: 'Suppression EPI' })
      .eq('id_epi', id_epi)
      .is('date_retour', null);

    const { error } = await supabase.from('epi').delete().eq('id_epi', id_epi);
    if (error) return fail(500, { error: 'Erreur suppression' });
    return { success: true };
  },

  attribuer_epi: async ({ request }) => {
    const fd = await request.formData();
    const id_epi = fd.get('id_epi') as string;
    const id_chauffeur = fd.get('id_chauffeur') as string;
    if (!id_epi || !id_chauffeur) return fail(400, { error: 'Données manquantes' });

    const today = new Date().toISOString().split('T')[0];
    await Promise.all([
      supabase.from('attribution').insert({ id_epi, id_chauffeur, date_attribution: today }),
      supabase.from('epi').update({ statut: 'attribué' }).eq('id_epi', id_epi),
    ]);
    return { success: true };
  },

  retirer_epi: async ({ request }) => {
    const fd = await request.formData();
    const id_attribution = fd.get('id_attribution') as string;
    const id_epi = fd.get('id_epi') as string;
    if (!id_attribution || !id_epi) return fail(400, { error: 'Données manquantes' });

    const today = new Date().toISOString().split('T')[0];
    await Promise.all([
      supabase
        .from('attribution')
        .update({ date_retour: today, motif_retour: 'Retrait manuel' })
        .eq('id_attribution', id_attribution),
      supabase.from('epi').update({ statut: 'disponible' }).eq('id_epi', id_epi),
    ]);
    return { success: true };
  },

  hors_service: async ({ request }) => {
    const fd = await request.formData();
    const id_epi = fd.get('id_epi') as string;
    const id_attribution = (fd.get('id_attribution') as string) || null;
    if (!id_epi) return fail(400, { error: 'ID manquant' });

    const today = new Date().toISOString().split('T')[0];
    await supabase.from('epi').update({ statut: 'hors_service' }).eq('id_epi', id_epi);
    if (id_attribution) {
      await supabase
        .from('attribution')
        .update({ date_retour: today, motif_retour: 'Hors service', etat_epi: 'hors_service' })
        .eq('id_attribution', id_attribution);
    }
    return { success: true };
  },

  remettre_en_service: async ({ request }) => {
    const fd = await request.formData();
    const id_epi = fd.get('id_epi') as string;
    if (!id_epi) return fail(400, { error: 'ID manquant' });
    await supabase.from('epi').update({ statut: 'disponible' }).eq('id_epi', id_epi);
    return { success: true };
  },

  ajouter_controle: async ({ request }) => {
    const fd = await request.formData();
    const id_epi = fd.get('id_epi') as string;
    const resultat = fd.get('resultat') as string;
    if (!id_epi || !resultat) return fail(400, { error: 'Données manquantes' });
    const today = new Date();
    const date_controle = today.toISOString().split('T')[0];
    const nextYear = new Date(today);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const prochain_controle = nextYear.toISOString().split('T')[0];
    const { error } = await supabase
      .from('controle')
      .insert({ id_epi, date_controle, prochain_controle, resultat });
    if (error) return fail(500, { error: 'Erreur enregistrement' });
    return { success: true };
  },

  remplacer_epi: async ({ request }) => {
    const fd = await request.formData();
    const id_epi = fd.get('id_epi') as string;
    const id_modele_epi = fd.get('id_modele_epi') as string;
    const id_attribution = (fd.get('id_attribution') as string) || null;
    const id_chauffeur = (fd.get('id_chauffeur') as string) || null;
    if (!id_epi || !id_modele_epi) return fail(400, { error: 'Données manquantes' });

    const today = new Date().toISOString().split('T')[0];

    // Marquer l'ancien EPI hors service et clore l'attribution
    await supabase.from('epi').update({ statut: 'hors_service' }).eq('id_epi', id_epi);
    if (id_attribution) {
      await supabase
        .from('attribution')
        .update({ date_retour: today, motif_retour: 'EPI expiré — remplacé' })
        .eq('id_attribution', id_attribution);
    }

    // Décrémenter stock_total et enregistrer l'historique
    const { data: modele } = await supabase
      .from('modele_epi')
      .select('stock_total')
      .eq('id_modele_epi', id_modele_epi)
      .single();
    const ancienne_valeur = modele?.stock_total ?? 0;
    const nouvelle_valeur = Math.max(0, ancienne_valeur - 1);
    await supabase
      .from('modele_epi')
      .update({ stock_total: nouvelle_valeur })
      .eq('id_modele_epi', id_modele_epi);
    await supabase.from('historique_stock').insert({
      id_modele_epi,
      ancienne_valeur,
      nouvelle_valeur,
      motif: 'EPI expiré retiré du stock',
    });

    // Créer le nouvel EPI (même modèle, pas de date_expiration — à renseigner si besoin)
    const { data: newEpi, error } = await supabase
      .from('epi')
      .insert({ id_modele_epi, statut: id_chauffeur ? 'attribué' : 'disponible' })
      .select('id_epi')
      .single();
    if (error || !newEpi) return fail(500, { error: 'Erreur création nouvel EPI' });

    // Transférer l'attribution au nouvel EPI si applicable
    if (id_chauffeur) {
      await supabase
        .from('attribution')
        .insert({ id_epi: newEpi.id_epi, id_chauffeur, date_attribution: today });
    }

    return { success: true };
  },
};
