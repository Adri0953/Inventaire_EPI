// Types partagés pour la page d'attribution des EPI par zone corporelle.
//
// Le schéma de base ne connaît pas la notion de « zone du corps » : un EPI n'a
// qu'une `designation` et un `type`. La zone est donc déduite par mots-clés
// (voir `inferZone`), comme le fait déjà la logique de presets des chauffeurs.

/** Zone corporelle protégée par un EPI. */
export type BodyZone = 'head' | 'eyes' | 'torso' | 'hands' | 'legs' | 'feet';

/** Une taille disponible d'un produit, reliée à une unité EPI attribuable. */
export interface EpiOption {
  /** Unité EPI disponible à attribuer pour cette taille (null si rupture). */
  idEpi: string | null;
  taille: string | null;
  available: number;
}

/** Un produit (modèle) regroupé pour une zone, avec ses tailles disponibles. */
export interface EpiItem {
  id: string; // clé de regroupement designation + type + zone
  name: string; // designation
  type: string;
  zone: BodyZone;
  stock: number; // total d'unités disponibles toutes tailles confondues
  seuil: number; // seuil_alerte du modèle
  options: EpiOption[];
}

/** Un EPI effectivement attribué à un chauffeur (attribution active). */
export interface AssignedEpi {
  idAttribution: string;
  idEpi: string;
  name: string;
  type: string;
  taille: string | null;
  dateExpiration: string | null;
}

/** Un chauffeur à équiper. */
export interface Driver {
  id: string;
  name: string;
  initials: string;
  activite: string | null;
}

/** Les EPI attribués à un chauffeur, indexés par zone (plusieurs possibles). */
export type Attribution = Partial<Record<BodyZone, AssignedEpi[]>>;

/** Carte des attributions de tous les chauffeurs (clé = driver.id). */
export type AttributionMap = Record<string, Attribution>;

/** Ordre d'affichage des zones (de la tête aux pieds). */
export const BODY_ZONES: BodyZone[] = ['head', 'eyes', 'torso', 'hands', 'legs', 'feet'];

/** Libellés français des zones, utilisés dans les titres. */
export const ZONE_LABELS: Record<BodyZone, string> = {
  head: 'Casques & couvre-chefs',
  eyes: 'Protection oculaire',
  torso: 'Vestes & gilets',
  hands: 'Gants',
  legs: 'Pantalons',
  feet: 'Chaussures de sécurité',
};

// Mots-clés (sans accents) utilisés pour rattacher un EPI à une zone.
const ZONE_KEYWORDS: Record<BodyZone, string[]> = {
  head: ['casque', 'casquette', 'couvre-chef', 'capuche', 'cagoule', 'bonnet', 'calot', 'tete'],
  eyes: ['lunette', 'visiere', 'oculaire', 'masque', 'ecran facial', 'soudure'],
  torso: [
    'gilet',
    'veste',
    'parka',
    'blouson',
    'combinaison',
    'harnais',
    'baudrier',
    'tablier',
    'chasuble',
    'manteau',
    'vetement',
    'tronc',
    'torse',
  ],
  hands: ['gant', 'mitaine', 'manchette', 'mains'],
  legs: ['pantalon', 'jambiere', 'genouillere', 'cuissard', 'salopette', 'short', 'jambe'],
  feet: ['chaussure', 'botte', 'basket', 'sabot', 'semelle', 'guetre', 'sandale', 'pied'],
};

/** Normalise une chaîne : minuscules + suppression des accents. */
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function zoneOf(text: string | null | undefined): BodyZone | null {
  if (!text) return null;
  const hay = normalize(text);
  for (const zone of BODY_ZONES) {
    if (ZONE_KEYWORDS[zone].some((kw) => hay.includes(kw))) return zone;
  }
  return null;
}

/**
 * Déduit la zone corporelle d'un EPI à partir de sa désignation puis de son type.
 * La désignation (nom du produit) est plus spécifique : elle est testée d'abord.
 */
export function inferZone(
  designation: string | null | undefined,
  type: string | null | undefined,
): BodyZone | null {
  return zoneOf(designation) ?? zoneOf(type);
}
