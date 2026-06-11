import { supabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const toDateStr = (d: Date) => d.toISOString().split('T')[0];

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  const [
    { data: expiringEpi },
    { data: allModeles },
    { data: pendingControls },
    { data: epiStats },
    { count: totalDrivers },
    { data: recentAssignments },
    { data: recentMovements },
    { data: activeAttributions },
  ] = await Promise.all([
    // 1. EPI expirés ou expirant dans < 30 jours + chauffeur associé
    supabase
      .from('epi')
      .select(
        'id_epi, date_expiration, modele_epi(designation), attribution(date_retour, chauffeur(nom, prenom))',
      )
      .lte('date_expiration', toDateStr(thirtyDaysFromNow))
      .order('date_expiration', { ascending: true }),

    // 2. Tous les modèles — filtrés côté serveur (comparaison colonne/colonne impossible en PostgREST)
    supabase
      .from('modele_epi')
      .select('id_modele_epi, designation, type, stock_total, seuil_alerte'),

    // 3. Contrôles en retard ou dus dans < 7 jours + chauffeur associé
    supabase
      .from('controle')
      .select(
        'id_controle, prochain_controle, epi(id_epi, modele_epi(designation), attribution(date_retour, chauffeur(nom, prenom)))',
      )
      .lte('prochain_controle', toDateStr(sevenDaysFromNow))
      .order('prochain_controle', { ascending: true }),

    // 4. Tous les EPI pour les stats par statut
    supabase.from('epi').select('statut'),

    // 5. Nombre total de chauffeurs
    supabase.from('chauffeur').select('id_chauffeur', { count: 'exact', head: true }),

    // 6. Dernières attributions
    supabase
      .from('attribution')
      .select(
        'id_attribution, date_attribution, chauffeur(nom, prenom), epi(modele_epi(designation))',
      )
      .order('date_attribution', { ascending: false })
      .order('id_attribution', { ascending: false })
      .limit(5),

    // 7. Derniers mouvements de stock
    supabase
      .from('historique_stock')
      .select(
        'id_historique, date_modification, motif, ancienne_valeur, nouvelle_valeur, modele_epi(designation)',
      )
      .order('date_modification', { ascending: false })
      .limit(5),

    // 8. Chauffeurs ayant au moins une attribution active (date_retour IS NULL)
    supabase.from('attribution').select('id_chauffeur').is('date_retour', null),
  ]);

  const totalStock = (allModeles || []).reduce((sum, m) => sum + (m.stock_total ?? 0), 0);
  const attribues = (activeAttributions || []).length;
  const horsService = (epiStats || []).filter((e) => e.statut === 'hors_service').length;
  const disponibles = totalStock - attribues - horsService;

  const stats = {
    total: totalStock,
    disponibles,
    attribues,
    horsService,
  };

  const driversWithEquipment = new Set((activeAttributions || []).map((a) => a.id_chauffeur)).size;
  const driversWithoutEquipment = (totalDrivers || 0) - driversWithEquipment;

  // Extrait le nom du chauffeur depuis une liste d'attributions (préfère celle sans date de retour)
  const extractDriver = (attributions: unknown): string | null => {
    const list = Array.isArray(attributions) ? attributions : attributions ? [attributions] : [];
    type Attr = {
      date_retour?: string | null;
      chauffeur?: { prenom: string; nom: string } | { prenom: string; nom: string }[];
    };
    const active =
      (list as Attr[]).find((a) => !a.date_retour) ?? (list as Attr[])[list.length - 1];
    if (!active) return null;
    const raw = active.chauffeur;
    const d = Array.isArray(raw) ? raw[0] : raw;
    return d ? `${d.prenom} ${d.nom}` : null;
  };

  return {
    stats: {
      ...stats,
      totalDrivers: totalDrivers || 0,
      driversWithoutEquipment,
    },
    activity: {
      assignments: (recentAssignments || []).map((a) => {
        const epi = Array.isArray(a.epi) ? a.epi[0] : a.epi;
        const modeleEpi =
          epi && (Array.isArray(epi.modele_epi) ? epi.modele_epi[0] : epi.modele_epi);
        const driver = Array.isArray(a.chauffeur) ? a.chauffeur[0] : a.chauffeur;
        return {
          ...a,
          epi_nom: modeleEpi?.designation,
          chauffeur_nom: driver ? `${driver.prenom} ${driver.nom}` : 'Inconnu',
        };
      }),
      movements: (recentMovements || []).map((m) => {
        const modeleEpi = Array.isArray(m.modele_epi) ? m.modele_epi[0] : m.modele_epi;
        return {
          ...m,
          epi_nom: modeleEpi?.designation,
        };
      }),
    },
    alerts: {
      expiring: (expiringEpi || []).map((e) => {
        const modeleEpi = Array.isArray(e.modele_epi) ? e.modele_epi[0] : e.modele_epi;
        return {
          ...e,
          nom: modeleEpi?.designation,
          chauffeur_nom: extractDriver(e.attribution),
        };
      }),
      lowStock: (allModeles || [])
        .filter((e) => e.seuil_alerte > 0 && e.stock_total / e.seuil_alerte <= 0.5)
        .sort((a, b) => {
          const rank = (e: typeof a) => {
            if (e.stock_total === 0) return 0;
            return e.stock_total / e.seuil_alerte <= 0.4 ? 1 : 2;
          };
          return rank(a) - rank(b);
        }),
      controls: (pendingControls || []).map((c) => {
        const epi = Array.isArray(c.epi) ? c.epi[0] : c.epi;
        const modeleEpi =
          epi && (Array.isArray(epi.modele_epi) ? epi.modele_epi[0] : epi.modele_epi);
        return {
          ...c,
          epi_id: (epi as { id_epi?: string } | null)?.id_epi ?? null,
          epi_nom: modeleEpi?.designation,
          chauffeur_nom: epi ? extractDriver(epi.attribution) : null,
        };
      }),
    },
  };
};
