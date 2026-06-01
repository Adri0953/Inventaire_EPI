import { supabase } from '$lib/supabase';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  const session = cookies.get('session');
  if (session) {
    throw redirect(303, '/dashboard');
  }
};

export const actions: Actions = {
  // Action pour gérer la connexion
  login: async ({ request, cookies }) => {
    // Récupération des données du formulaire
    const data = await request.formData();
    const email = data.get('email') as string;
    const password = data.get('password') as string;

    // Vérification des champs requis
    if (!email || !password) {
      return fail(400, { error: 'Email and password are required.' });
    }

    // Requete d'authentification à Supabase
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Gestion des erreurs d'authentification
    if (error) {
      return fail(400, { error: error.message });
    }

    // Cookies pour stocker la session
    if (authData.session) {
      cookies.set('session', authData.session.access_token, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
    }

    throw redirect(303, '/dashboard');
  },
  logout: async ({ cookies }) => {
    cookies.delete('session', { path: '/' });
    throw redirect(303, '/');
  },
};
