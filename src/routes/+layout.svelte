<script lang="ts">
  import './layout.css';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
  import { goto, onNavigate } from '$app/navigation';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import { ROUTES } from '$lib/nav';
  import favicon from '$lib/assets/favicon.svg';
  import logo from '$lib/assets/logo.jpg';
  export let data;

  // Couleur d'accentuation par section : { fond sombre, accent vif }
  const ACCENTS: Record<string, { dark: string; accent: string }> = {
    '/dashboard': { dark: '#1d4ed8', accent: '#3b82f6' },
    '/chauffeurs': { dark: '#1d4ed8', accent: '#2563eb' },
    '/epi': { dark: '#5b21b6', accent: '#7c3aed' },
    '/attributions': { dark: '#047857', accent: '#059669' },
    '/stocks': { dark: '#d4a017', accent: '#eab308' },
  };
  const DEFAULT_ACCENT = { dark: '#0f1f5c', accent: '#3b82f6' };

  $: currentIndex = ROUTES.findIndex((r) => $page.url.pathname.startsWith(r));
  $: prevRoute = currentIndex > 0 ? ROUTES[currentIndex - 1] : null;
  $: nextRoute = currentIndex < ROUTES.length - 1 ? ROUTES[currentIndex + 1] : null;

  $: theme =
    ROUTES.map((r) => ({ r, t: ACCENTS[r] })).find(({ r }) => $page.url.pathname.startsWith(r))
      ?.t ?? DEFAULT_ACCENT;

  onNavigate((nav) => {
    if (!document.startViewTransition) return;
    const toIndex = ROUTES.findIndex((r) => nav.to?.url.pathname.startsWith(r));
    const fromIndex = ROUTES.findIndex((r) => nav.from?.url.pathname.startsWith(r));
    document.documentElement.dataset.navDir =
      toIndex >= 0 && fromIndex >= 0 && fromIndex > toIndex ? 'backward' : 'forward';
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await nav.complete;
      });
    });
  });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="app">
  <header class="app-header" style="--h-dark: {theme.dark}; --h-accent: {theme.accent}">
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href="/dashboard" class="header-title">
      <img src={logo} alt="Logo" />
      <h1>Inventaire EPI</h1>
    </a>

    {#if data.session}
      <nav class="app-nav">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href="/dashboard" class="nav-link {$page.url.pathname === '/dashboard' ? 'active' : ''}">
          Dashboard
        </a>
        <a
          href={resolve('/chauffeurs')}
          class="nav-link {$page.url.pathname.startsWith('/chauffeurs') ? 'active' : ''}"
        >
          Chauffeurs
        </a>
        <a
          href={resolve('/epi')}
          class="nav-link {$page.url.pathname.startsWith('/epi') ? 'active' : ''}"
        >
          EPI
        </a>
        <a
          href={resolve('/attributions')}
          class="nav-link {$page.url.pathname.startsWith('/attributions') ? 'active' : ''}"
        >
          Attributions
        </a>
        <a
          href={resolve('/stocks')}
          class="nav-link {$page.url.pathname.startsWith('/stocks') ? 'active' : ''}"
        >
          Stocks
        </a>
      </nav>

      <form method="POST" action="/?/logout">
        <button type="submit" class="btn-logout">Déconnexion</button>
      </form>
    {/if}
  </header>

  {#if data.session && currentIndex >= 0}
    {#if prevRoute}
      <button
        onclick={() => goto(prevRoute)}
        class="fixed left-2 top-1/2 z-50 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 opacity-40 shadow-md backdrop-blur-sm transition-opacity hover:opacity-100"
        aria-label="Page précédente"
      >
        <ChevronLeft class="h-5 w-5" />
      </button>
    {/if}
    {#if nextRoute}
      <button
        onclick={() => goto(nextRoute)}
        class="fixed right-2 top-1/2 z-50 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 opacity-40 shadow-md backdrop-blur-sm transition-opacity hover:opacity-100"
        aria-label="Page suivante"
      >
        <ChevronRight class="h-5 w-5" />
      </button>
    {/if}
  {/if}

  <main class="app-main">
    <slot />
  </main>
</div>

<ConfirmModal />