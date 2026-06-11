import { supabase } from '$lib/supabase';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const [modelesResult, episResult, historiquesResult, controlesResult] = await Promise.all([
    supabase.from('modele_epi').select('*').order('designation'),
    supabase.from('epi').select('id_modele_epi, statut, date_expiration').range(0, 9999),
    supabase
      .from('historique_stock')
      .select('*, modele_epi(designation)')
      .order('date_modification', { ascending: false })
      .limit(500),
    supabase
      .from('controle')
      .select('id_epi, prochain_controle')
      .order('prochain_controle', { ascending: true }),
  ]);

  const today = new Date().toISOString().split('T')[0];

  // Par modèle : compte les unités indisponibles (attribuées, hors service, ou expirées).
  const indisponiblesParModele: Record<string, number> = {};
  const attribuesParModele: Record<string, number> = {};
  for (const e of episResult.data ?? []) {
    const estAttribue = e.statut === 'attribué';
    const estHorsService = e.statut === 'hors_service';
    const estExpire = e.date_expiration != null && e.date_expiration < today;
    if (estAttribue || estHorsService || estExpire) {
      indisponiblesParModele[e.id_modele_epi] = (indisponiblesParModele[e.id_modele_epi] ?? 0) + 1;
    }
    if (estAttribue) {
      attribuesParModele[e.id_modele_epi] = (attribuesParModele[e.id_modele_epi] ?? 0) + 1;
    }
  }

  return {
    modeles: modelesResult.data ?? [],
    indisponiblesParModele,
    attribuesParModele,
    totalAttribues: Object.values(attribuesParModele).reduce((s, n) => s + n, 0),
    historiques: historiquesResult.data ?? [],
    controles: controlesResult.data ?? [],
  };
};

// Pré-calcule une date d'échéance à partir d'un raccourci ('6mois', '1an', '2ans').
function calcEcheance(intervalle: string | null): string | null {
  if (!intervalle) return null;
  const d = new Date();
  if (intervalle === '6mois') d.setMonth(d.getMonth() + 6);
  else if (intervalle === '1an') d.setFullYear(d.getFullYear() + 1);
  else if (intervalle === '2ans') d.setFullYear(d.getFullYear() + 2);
  else return null;
  return d.toISOString().split('T')[0];
}

export const actions: Actions = {
  // Crée un modèle EPI + N unités physiques (et leurs contrôles le cas échéant) d'un coup.
  ajouterModeleEtUnites: async ({ request }) => {
    const fd = await request.formData();
    const designation = (fd.get('designation') as string)?.trim();
    const type = (fd.get('type') as string)?.trim();
    const taille = (fd.get('taille') as string)?.trim() || null;
    const stock_total = parseInt(fd.get('stock_total') as string) || 0;
    const seuil_alerte = parseInt(fd.get('seuil_alerte') as string) || 0;
    const quantite_initiale = parseInt(fd.get('quantite_initiale') as string) || 0;
    const mode_echeance = fd.get('mode_echeance') as 'expiration' | 'controle';
    const intervalle = (fd.get('intervalle') as string) || null;
    const commentaire = (fd.get('commentaire') as string)?.trim() || null;

    if (!designation || !type) return fail(400, { error: 'Désignation et type requis' });
    if (mode_echeance !== 'expiration' && mode_echeance !== 'controle')
      return fail(400, { error: "Mode d'échéance invalide" });

    // La date provient soit du champ manuel, soit d'un raccourci pré-calculé.
    const date_valeur = (fd.get('date_valeur') as string) || calcEcheance(intervalle);
    if (quantite_initiale > 0 && !date_valeur)
      return fail(400, { error: 'Date ou intervalle requis pour créer des unités' });

    // 1. Insérer le modèle et récupérer son id.
    const { data: modele, error: modeleError } = await supabase
      .from('modele_epi')
      .insert({ designation, type, taille, stock_total, seuil_alerte })
      .select('id_modele_epi')
      .single();
    if (modeleError || !modele) return fail(500, { error: 'Erreur lors de la création du modèle' });

    const id_modele_epi = modele.id_modele_epi;

    // 2. Créer les unités EPI.
    if (quantite_initiale > 0) {
      const rows = Array.from({ length: quantite_initiale }, () => ({
        id_modele_epi,
        statut: 'disponible',
        // Exclusivité : expiration → date renseignée ; contrôle → date_expiration null.
        date_expiration: mode_echeance === 'expiration' ? date_valeur : null,
      }));

      const { data: episCrees, error: episError } = await supabase
        .from('epi')
        .insert(rows)
        .select('id_epi');
      if (episError || !episCrees)
        return fail(500, { error: 'Erreur lors de la création des unités' });

      // 3. En mode contrôle : créer un contrôle initial conforme par unité.
      if (mode_echeance === 'controle') {
        const today = new Date().toISOString().split('T')[0];
        const controles = episCrees.map((e) => ({
          id_epi: e.id_epi,
          date_controle: today,
          resultat: 'conforme',
          prochain_controle: date_valeur,
          commentaire,
        }));
        const { error: ctrlError } = await supabase.from('controle').insert(controles);
        if (ctrlError) return fail(500, { error: 'Erreur lors de la création des contrôles' });
      }
    }

    // 4. Tracer la création dans l'historique de stock.
    await supabase.from('historique_stock').insert({
      id_modele_epi,
      date_modification: new Date().toISOString(),
      ancienne_valeur: 0,
      nouvelle_valeur: quantite_initiale,
      motif: 'Création initiale',
    });

    return { success: true };
  },

  // Met à jour un modèle existant ; trace l'historique si le stock total change.
  modifierModele: async ({ request }) => {
    const fd = await request.formData();
    const id_modele_epi = fd.get('id_modele_epi') as string;
    const designation = (fd.get('designation') as string)?.trim();
    const type = (fd.get('type') as string)?.trim();
    const taille = (fd.get('taille') as string)?.trim() || null;
    const stock_total = parseInt(fd.get('stock_total') as string) || 0;
    const seuil_alerte = parseInt(fd.get('seuil_alerte') as string) || 0;

    if (!id_modele_epi) return fail(400, { error: 'ID manquant' });
    if (!designation || !type) return fail(400, { error: 'Désignation et type requis' });

    // Récupérer l'ancien stock pour détecter un changement.
    const { data: ancien } = await supabase
      .from('modele_epi')
      .select('stock_total')
      .eq('id_modele_epi', id_modele_epi)
      .single();

    const { error } = await supabase
      .from('modele_epi')
      .update({ designation, type, taille, stock_total, seuil_alerte })
      .eq('id_modele_epi', id_modele_epi);
    if (error) return fail(500, { error: 'Erreur lors de la modification' });

    if (ancien && ancien.stock_total !== stock_total) {
      await supabase.from('historique_stock').insert({
        id_modele_epi,
        date_modification: new Date().toISOString(),
        ancienne_valeur: ancien.stock_total,
        nouvelle_valeur: stock_total,
        motif: 'Modification manuelle',
      });
    }

    return { success: true };
  },

  // Ajuste le stock_total d'un modèle par un delta (positif ou négatif) et trace l'historique.
  ajusterStock: async ({ request }) => {
    const fd = await request.formData();
    const id_modele_epi = fd.get('id') as string;
    const delta = parseInt(fd.get('delta') as string);
    const motif = (fd.get('motif') as string)?.trim() || null;

    if (!id_modele_epi || isNaN(delta)) return fail(400, { error: 'Paramètres invalides.' });
    if (delta === 0) return fail(400, { error: 'Le delta ne peut pas être zéro.' });

    const { data: modele } = await supabase
      .from('modele_epi')
      .select('stock_total')
      .eq('id_modele_epi', id_modele_epi)
      .single();

    if (!modele) return fail(400, { error: 'Modèle introuvable.' });

    const ancienne = modele.stock_total;
    const nouvelle = ancienne + delta;

    if (nouvelle < 0) return fail(400, { error: 'Le stock ne peut pas être négatif.' });

    const { error } = await supabase
      .from('modele_epi')
      .update({ stock_total: nouvelle })
      .eq('id_modele_epi', id_modele_epi);
    if (error) return fail(500, { error: 'Erreur lors de la mise à jour du stock.' });

    await supabase.from('historique_stock').insert({
      id_modele_epi,
      date_modification: new Date().toISOString(),
      ancienne_valeur: ancienne,
      nouvelle_valeur: nouvelle,
      motif: motif || (delta > 0 ? 'Approvisionnement' : 'Retrait de stock'),
    });

    return { success: true };
  },

  // Supprime un modèle, sauf si des unités lui sont encore attribuées.
  supprimerModele: async ({ request }) => {
    const fd = await request.formData();
    const id_modele_epi = fd.get('id_modele_epi') as string;
    if (!id_modele_epi) return fail(400, { error: 'ID manquant' });

    const { count } = await supabase
      .from('epi')
      .select('id_epi', { count: 'exact', head: true })
      .eq('id_modele_epi', id_modele_epi)
      .eq('statut', 'attribué');
    if ((count ?? 0) > 0)
      return fail(400, { error: 'Des unités sont encore attribuées à ce modèle' });

    const { error } = await supabase.from('modele_epi').delete().eq('id_modele_epi', id_modele_epi);
    if (error) return fail(500, { error: 'Erreur lors de la suppression' });

    return { success: true };
  },
};
