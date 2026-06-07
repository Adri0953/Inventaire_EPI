import { supabase } from '$lib/supabase';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import type {
  AssignedEpi,
  AttributionMap,
  Driver,
  EpiItem,
  EpiOption,
} from '$lib/types/attributions';
import { inferZone } from '$lib/types/attributions';

// Normalise une relation Supabase qui peut arriver sous forme d'objet ou de tableau.
function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export const load: PageServerLoad = async () => {
  const [{ data: chauffeursRaw }, { data: episRaw }, { data: attrsRaw }] = await Promise.all([
    supabase.from('chauffeur').select('id_chauffeur, prenom, nom, activite').order('nom'),
    supabase
      .from('epi')
      .select(
        'id_epi, statut, date_expiration, modele_epi(id_modele_epi, designation, type, taille, seuil_alerte)',
      ),
    supabase
      .from('attribution')
      .select(
        'id_attribution, id_chauffeur, id_epi, date_attribution, epi(date_expiration, modele_epi(designation, type, taille))',
      )
      .is('date_retour', null),
  ]);

  // ── Chauffeurs ──────────────────────────────────────────────────────────
  const drivers: Driver[] = (chauffeursRaw ?? []).map((c) => ({
    id: c.id_chauffeur,
    name: `${c.prenom} ${c.nom}`,
    initials: `${c.prenom?.[0] ?? ''}${c.nom?.[0] ?? ''}`.toUpperCase(),
    activite: c.activite ?? null,
  }));

  // ── Catalogue regroupé par produit (designation + type) puis par taille ──
  type Product = {
    id: string;
    name: string;
    type: string;
    zone: NonNullable<ReturnType<typeof inferZone>>;
    seuil: number;
    options: Map<string, { idEpi: string | null; taille: string | null; available: number }>;
  };
  const products = new Map<string, Product>();

  for (const e of episRaw ?? []) {
    const modele = first(e.modele_epi);
    if (!modele) continue;
    const zone = inferZone(modele.designation, modele.type);
    if (!zone) continue;

    const pKey = `${modele.designation}__${modele.type}__${zone}`;
    let product = products.get(pKey);
    if (!product) {
      product = {
        id: pKey,
        name: modele.designation,
        type: modele.type,
        zone,
        seuil: modele.seuil_alerte ?? 0,
        options: new Map(),
      };
      products.set(pKey, product);
    }

    const sizeKey = modele.taille ?? '__std__';
    let option = product.options.get(sizeKey);
    if (!option) {
      option = { idEpi: null, taille: modele.taille ?? null, available: 0 };
      product.options.set(sizeKey, option);
    }
    if (e.statut === 'disponible') {
      option.available += 1;
      if (!option.idEpi) option.idEpi = e.id_epi;
    }
  }

  const epiCatalog: EpiItem[] = [...products.values()]
    .map((p) => {
      const options: EpiOption[] = [...p.options.values()].sort((a, b) =>
        (a.taille ?? '').localeCompare(b.taille ?? '', 'fr', { numeric: true }),
      );
      const stock = options.reduce((sum, o) => sum + o.available, 0);
      return { id: p.id, name: p.name, type: p.type, zone: p.zone, stock, seuil: p.seuil, options };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  // ── Attributions actives par chauffeur, indexées par zone ────────────────
  const attributionsByDriver: AttributionMap = {};
  for (const a of attrsRaw ?? []) {
    const epi = first(a.epi);
    const modele = first(epi?.modele_epi);
    if (!modele) continue;
    const zone = inferZone(modele.designation, modele.type);
    if (!zone) continue;

    const assigned: AssignedEpi = {
      idAttribution: a.id_attribution,
      idEpi: a.id_epi,
      name: modele.designation,
      type: modele.type,
      taille: modele.taille ?? null,
      dateExpiration: epi?.date_expiration ?? null,
    };

    const byZone = (attributionsByDriver[a.id_chauffeur] ??= {});
    (byZone[zone] ??= []).push(assigned);
  }

  return { drivers, epiCatalog, attributionsByDriver };
};

export const actions: Actions = {
  // Attribue une unité EPI disponible à un chauffeur.
  attribuer: async ({ request }) => {
    const fd = await request.formData();
    const id_chauffeur = fd.get('id_chauffeur') as string;
    const id_epi = fd.get('id_epi') as string;
    if (!id_chauffeur || !id_epi) return fail(400, { error: 'Données manquantes' });

    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('attribution')
      .insert({ id_chauffeur, id_epi, date_attribution: today });
    if (error) return fail(500, { error: "Erreur lors de l'attribution" });

    await supabase.from('epi').update({ statut: 'attribué' }).eq('id_epi', id_epi);
    return { success: true };
  },

  // Retire un EPI d'un chauffeur (clôture l'attribution + remet l'EPI disponible).
  retirer: async ({ request }) => {
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
};
