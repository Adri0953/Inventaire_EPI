import { supabase } from '$lib/supabase';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const [{ data: chauffeurs }, { data: activeAttributions }] = await Promise.all([
    supabase.from('chauffeur').select('id_chauffeur, prenom, nom, activite').order('nom'),
    supabase
      .from('attribution')
      .select(
        `id_attribution, id_chauffeur, date_attribution,
				epi(
					id_epi, statut, date_expiration,
					modele_epi(id_modele_epi, designation, type, taille),
					controle(id_controle, prochain_controle, resultat)
				)`,
      )
      .is('date_retour', null)
      .order('date_attribution', { ascending: false }),
  ]);

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

  type EpiInfo = {
    id_attribution: string;
    date_attribution: string;
    id_epi: string;
    statut: string;
    date_expiration: string | null;
    id_modele_epi: string;
    designation: string;
    type: string;
    taille: string | null;
    prochain_controle: string | null;
  };

  const episByDriver: Record<string, EpiInfo[]> = {};

  for (const attr of activeAttributions ?? []) {
    const epi = Array.isArray(attr.epi) ? attr.epi[0] : attr.epi;
    if (!epi) continue;
    const modele = Array.isArray(epi.modele_epi) ? epi.modele_epi[0] : epi.modele_epi;
    if (!modele) continue;

    const controles = Array.isArray(epi.controle)
      ? epi.controle
      : epi.controle
        ? [epi.controle]
        : [];
    const nextControle = controles
      .filter((c: { prochain_controle: string | null }) => c.prochain_controle)
      .sort(
        (a: { prochain_controle: string }, b: { prochain_controle: string }) =>
          new Date(b.prochain_controle).getTime() - new Date(a.prochain_controle).getTime(),
      )[0];

    if (!episByDriver[attr.id_chauffeur]) episByDriver[attr.id_chauffeur] = [];
    episByDriver[attr.id_chauffeur].push({
      id_attribution: attr.id_attribution,
      date_attribution: attr.date_attribution,
      id_epi: epi.id_epi,
      statut: epi.statut,
      date_expiration: epi.date_expiration ?? null,
      id_modele_epi: modele.id_modele_epi,
      designation: modele.designation,
      type: modele.type,
      taille: modele.taille ?? null,
      prochain_controle: nextControle?.prochain_controle ?? null,
    });
  }

  const result = (chauffeurs ?? []).map((c) => ({
    ...c,
    epis: episByDriver[c.id_chauffeur] ?? [],
    hasExpiringEpi: (episByDriver[c.id_chauffeur] ?? []).some(
      (e) => e.date_expiration && e.date_expiration <= thirtyDaysStr && e.date_expiration >= today,
    ),
    hasExpiredEpi: (episByDriver[c.id_chauffeur] ?? []).some(
      (e) => e.date_expiration && e.date_expiration < today,
    ),
  }));

  return { chauffeurs: result };
};

export const actions: Actions = {
  supprimer: async ({ request }) => {
    const formData = await request.formData();
    const id_chauffeur = formData.get('id_chauffeur') as string;
    if (!id_chauffeur) return fail(400, { error: 'ID chauffeur manquant' });

    const today = new Date().toISOString().split('T')[0];

    const { data: attributions } = await supabase
      .from('attribution')
      .select('id_attribution, id_epi')
      .eq('id_chauffeur', id_chauffeur)
      .is('date_retour', null);

    if (attributions && attributions.length > 0) {
      const epiIds = attributions.map((a) => a.id_epi);

      await Promise.all([
        supabase
          .from('attribution')
          .update({ date_retour: today, motif_retour: 'Suppression chauffeur' })
          .eq('id_chauffeur', id_chauffeur)
          .is('date_retour', null),
        supabase.from('epi').update({ statut: 'disponible' }).in('id_epi', epiIds),
      ]);
    }

    const { error } = await supabase.from('chauffeur').delete().eq('id_chauffeur', id_chauffeur);

    if (error) return fail(500, { error: 'Erreur lors de la suppression' });
    return { success: true };
  },

  retirer_epi: async ({ request }) => {
    const formData = await request.formData();
    const id_attribution = formData.get('id_attribution') as string;
    const id_epi = formData.get('id_epi') as string;
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
    const formData = await request.formData();
    const id_attribution = formData.get('id_attribution') as string;
    const id_epi = formData.get('id_epi') as string;
    if (!id_attribution || !id_epi) return fail(400, { error: 'Données manquantes' });

    const today = new Date().toISOString().split('T')[0];

    await Promise.all([
      supabase
        .from('attribution')
        .update({ date_retour: today, motif_retour: 'Mise hors service', etat_epi: 'hors_service' })
        .eq('id_attribution', id_attribution),
      supabase.from('epi').update({ statut: 'hors_service' }).eq('id_epi', id_epi),
    ]);

    return { success: true };
  },

  transferer_epi: async ({ request }) => {
    const formData = await request.formData();
    const id_attribution = formData.get('id_attribution') as string;
    const id_epi = formData.get('id_epi') as string;
    const id_chauffeur_dest = formData.get('id_chauffeur_dest') as string;
    if (!id_attribution || !id_epi || !id_chauffeur_dest)
      return fail(400, { error: 'Données manquantes' });

    const today = new Date().toISOString().split('T')[0];

    await supabase
      .from('attribution')
      .update({ date_retour: today, motif_retour: 'Transfert' })
      .eq('id_attribution', id_attribution);

    await supabase.from('attribution').insert({
      id_chauffeur: id_chauffeur_dest,
      id_epi,
      date_attribution: today,
    });

    return { success: true };
  },

  transferer_tout: async ({ request }) => {
    const formData = await request.formData();
    const id_chauffeur_src = formData.get('id_chauffeur_src') as string;
    const id_chauffeur_dest = formData.get('id_chauffeur_dest') as string;
    if (!id_chauffeur_src || !id_chauffeur_dest) return fail(400, { error: 'Données manquantes' });
    if (id_chauffeur_src === id_chauffeur_dest)
      return fail(400, { error: 'Chauffeurs identiques' });

    const today = new Date().toISOString().split('T')[0];

    const { data: attributions } = await supabase
      .from('attribution')
      .select('id_attribution, id_epi')
      .eq('id_chauffeur', id_chauffeur_src)
      .is('date_retour', null);

    if (!attributions || attributions.length === 0) return { success: true };

    await supabase
      .from('attribution')
      .update({ date_retour: today, motif_retour: 'Transfert groupé' })
      .eq('id_chauffeur', id_chauffeur_src)
      .is('date_retour', null);

    await supabase.from('attribution').insert(
      attributions.map((a) => ({
        id_chauffeur: id_chauffeur_dest,
        id_epi: a.id_epi,
        date_attribution: today,
      })),
    );

    return { success: true };
  },

  modifier_chauffeur: async ({ request }) => {
    const formData = await request.formData();
    const id_chauffeur = formData.get('id_chauffeur') as string;
    const prenom = (formData.get('prenom') as string | null)?.trim();
    const nom = (formData.get('nom') as string | null)?.trim();
    const activite = (formData.get('activite') as string | null)?.trim() || null;

    if (!id_chauffeur || !prenom || !nom) return fail(400, { error: 'Données manquantes' });

    const { error } = await supabase
      .from('chauffeur')
      .update({ prenom, nom, activite })
      .eq('id_chauffeur', id_chauffeur);

    if (error) return fail(500, { error: 'Erreur lors de la modification' });
    return { success: true };
  },
};
