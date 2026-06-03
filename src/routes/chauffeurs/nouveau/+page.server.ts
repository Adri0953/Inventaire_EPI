import { supabase } from '$lib/supabase';
import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const [{ data: modeles }, { data: episDisponibles }] = await Promise.all([
		supabase
			.from('modele_epi')
			.select('id_modele_epi, designation, type, taille, stock_total')
			.order('type')
			.order('designation'),
		supabase
			.from('epi')
			.select('id_epi, date_expiration, id_modele_epi')
			.eq('statut', 'disponible')
			.order('date_expiration', { ascending: true, nullsFirst: false }),
	]);

	return {
		modeles: modeles ?? [],
		episDisponibles: episDisponibles ?? [],
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();

		const prenom = (formData.get('prenom') as string | null)?.trim();
		const nom = (formData.get('nom') as string | null)?.trim();
		const activite = (formData.get('activite') as string | null)?.trim() || null;
		const episRaw = formData.get('epis') as string | null;

		if (!prenom || !nom) {
			return fail(400, { error: 'Le prénom et le nom sont requis.' });
		}

		type EpiEntry = { id_epi: string; expiration?: string };
		let epis: EpiEntry[] = [];
		try {
			epis = episRaw ? JSON.parse(episRaw) : [];
		} catch {
			return fail(400, { error: 'Données EPI invalides.' });
		}

		// Deduplicate
		const seen = new Set<string>();
		epis = epis.filter((e) => {
			if (!e.id_epi || seen.has(e.id_epi)) return false;
			seen.add(e.id_epi);
			return true;
		});

		// 1. Créer le chauffeur
		const { data: chauffeur, error: chauffeurError } = await supabase
			.from('chauffeur')
			.insert({ prenom, nom, activite })
			.select('id_chauffeur')
			.single();

		if (chauffeurError || !chauffeur) {
			console.error('Erreur création chauffeur:', chauffeurError);
			return fail(500, { error: 'Erreur lors de la création du chauffeur.' });
		}

		const today = new Date().toISOString().split('T')[0];

		// 2. Créer les attributions et mettre à jour les statuts
		for (const epi of epis) {
			await Promise.all([
				supabase.from('attribution').insert({
					id_chauffeur: chauffeur.id_chauffeur,
					id_epi: epi.id_epi,
					date_attribution: today,
				}),
				supabase
					.from('epi')
					.update({
						statut: 'attribué',
						...(epi.expiration ? { date_expiration: epi.expiration } : {}),
					})
					.eq('id_epi', epi.id_epi),
			]);
		}

		throw redirect(303, '/dashboard');
	},
};
