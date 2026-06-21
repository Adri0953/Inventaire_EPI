<script lang="ts">
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { confirmAction } from '$lib/stores/confirm';
  import {
    Package,
    Boxes,
    CircleCheck,
    UserCheck,
    TriangleAlert,
    Plus,
    Pencil,
    Trash2,
    X,
    History,
    Search,
    Info,
    ArrowUp,
    ArrowDown,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    CalendarRange,
  } from 'lucide-svelte';
  import { fly, fade, slide } from 'svelte/transition';
  import { quintOut, cubicIn } from 'svelte/easing';
  import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte';

  let { data }: { data: PageData } = $props();

  type Modele = (typeof data.modeles)[0];

  // ── État ───────────────────────────────────────────────────────────────
  let panneauOuvert = $state(false);
  let modeleEnEdition = $state<Modele | null>(null);
  let panneauHistorique = $state(false);
  let modeEcheance = $state<'expiration' | 'controle'>('expiration');
  let dateValeur = $state('');
  let recherche = $state('');
  let filtreType = $state('');
  let filtreAlerte = $state('');
  let triColonne = $state<SortCol>('designation');
  let triAsc = $state(true);
  let loading = $state(false);

  // ── Popover ajustement stock ──────────────────────────────────────────
  let popoverModele = $state<Modele | null>(null);
  let popoverX = $state(0);
  let popoverY = $state(0);
  let deltaInput = $state(0);
  let motifInput = $state('');

  // Champs du formulaire de création / édition.
  let fDesignation = $state('');
  let fType = $state('');
  let fTaille = $state('');
  let fStockTotal = $state(1);
  let fSeuilAlerte = $state(1);
  let fQuantiteInitiale = $state(0);
  let fCommentaire = $state('');

  // ── Données calculées ────────────────────────────────────────────────
  // dispo = stock_total − (attribués + hors_service + expirés)
  const disponiblesParModele = $derived.by(() => {
    const map: Record<string, number> = {};
    for (const m of data.modeles) {
      map[m.id_modele_epi] = Math.max(
        0,
        m.stock_total - (data.indisponiblesParModele[m.id_modele_epi] ?? 0),
      );
    }
    return map;
  });

  const nouveauStock = $derived(popoverModele ? popoverModele.stock_total + deltaInput : 0);

  const stats = $derived({
    totalModeles: data.modeles.length,
    disponibles: data.modeles.reduce(
      (s, m) =>
        s + Math.max(0, m.stock_total - (data.indisponiblesParModele[m.id_modele_epi] ?? 0)),
      0,
    ),
    attribues: data.totalAttribues,
    alertes: data.modeles.filter((m) => {
      const dispo = Math.max(
        0,
        m.stock_total - (data.indisponiblesParModele[m.id_modele_epi] ?? 0),
      );
      return getBadgeAlerte(m, dispo).label !== 'OK';
    }).length,
  });

  const allTypes = $derived(
    [...new Set(data.modeles.map((m) => m.type).filter(Boolean))].sort() as string[],
  );

  type SortCol = 'designation' | 'type' | 'taille' | 'alerte';

  const alerteOrdre: Record<string, number> = { Rupture: 0, Critique: 1, Bas: 2, OK: 3 };

  function toggleSort(col: SortCol) {
    if (triColonne === col) triAsc = !triAsc;
    else {
      triColonne = col;
      triAsc = true;
    }
  }

  const modelesFiltres = $derived.by(() => {
    let liste = data.modeles;
    if (recherche) {
      const q = recherche.toLowerCase();
      liste = liste.filter(
        (m) => m.designation.toLowerCase().includes(q) || (m.type ?? '').toLowerCase().includes(q),
      );
    }
    if (filtreType) liste = liste.filter((m) => m.type === filtreType);
    if (filtreAlerte === 'rupture')
      liste = liste.filter((m) => (disponiblesParModele[m.id_modele_epi] ?? 0) === 0);
    if (filtreAlerte === 'alerte')
      liste = liste.filter((m) => (disponiblesParModele[m.id_modele_epi] ?? 0) <= m.seuil_alerte);
    if (filtreAlerte === 'ok')
      liste = liste.filter((m) => (disponiblesParModele[m.id_modele_epi] ?? 0) > m.seuil_alerte);

    return [...liste].sort((a, b) => {
      let cmp: number;
      if (triColonne === 'alerte') {
        const da = disponiblesParModele[a.id_modele_epi] ?? 0;
        const db = disponiblesParModele[b.id_modele_epi] ?? 0;
        cmp =
          (alerteOrdre[getBadgeAlerte(a, da).label] ?? 4) -
          (alerteOrdre[getBadgeAlerte(b, db).label] ?? 4);
      } else {
        const va = a[triColonne] ?? '';
        const vb = b[triColonne] ?? '';
        cmp = String(va).localeCompare(String(vb), 'fr');
      }
      return triAsc ? cmp : -cmp;
    });
  });

  // Badge d'alerte basé sur le nombre réel d'unités disponibles.
  function getBadgeAlerte(modele: Modele, disponibles: number) {
    if (disponibles === 0) return { label: 'Rupture', class: 'bg-red-100 text-red-700' };
    const ratio = modele.seuil_alerte > 0 ? disponibles / modele.seuil_alerte : Infinity;
    if (ratio <= 0.4) return { label: 'Critique', class: 'bg-orange-100 text-orange-700' };
    if (disponibles <= modele.seuil_alerte * 0.5)
      return { label: 'Bas', class: 'bg-yellow-100 text-yellow-700' };
    return { label: 'OK', class: 'bg-emerald-100 text-emerald-700' };
  }

  // ── Pagination infinie ────────────────────────────────────────────────
  const PAGE_SIZE = 15;
  let visibleCount = $state(PAGE_SIZE);
  $effect(() => {
    void [recherche, filtreType, filtreAlerte, triColonne, triAsc];
    visibleCount = PAGE_SIZE;
  });
  const modelesVisibles = $derived(modelesFiltres.slice(0, visibleCount));

  // ── Ouverture des panneaux ────────────────────────────────────────────
  function ouvrirCreation() {
    modeleEnEdition = null;
    fDesignation = '';
    fType = '';
    fTaille = '';
    fStockTotal = 1;
    fSeuilAlerte = 1;
    fQuantiteInitiale = 0;
    fCommentaire = '';
    modeEcheance = 'expiration';
    dateValeur = '';
    panneauOuvert = true;
  }

  function ouvrirEdition(m: Modele) {
    modeleEnEdition = m;
    fDesignation = m.designation;
    fType = m.type ?? '';
    fTaille = m.taille ?? '';
    fStockTotal = m.stock_total;
    fSeuilAlerte = m.seuil_alerte;
    panneauOuvert = true;
  }

  // Bascule entre les deux modes d'échéance : réinitialise la date pour éviter
  // qu'une valeur saisie dans un mode soit envoyée dans l'autre contexte.
  function setMode(mode: 'expiration' | 'controle') {
    modeEcheance = mode;
    dateValeur = '';
  }

  function ouvrirPopover(e: MouseEvent, modele: Modele) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    popoverX = Math.min(rect.left, window.innerWidth - 300);
    popoverY = rect.bottom + 8;
    popoverModele = modele;
    deltaInput = 0;
    motifInput = '';
  }

  // Maintenir appuyé pour défiler : délai initial 400ms puis intervalle décroissant jusqu'à 50ms.
  function startHold(fn: () => void) {
    fn();
    let interval: ReturnType<typeof setInterval>;
    let delay = 300;
    const step = () => {
      fn();
      delay = Math.max(50, delay - 30);
      interval = setTimeout(step, delay);
    };
    interval = setTimeout(step, 400);
    return () => clearTimeout(interval);
  }

  // ── Filtres historique ───────────────────────────────────────────────
  let triHistorique = $state<'recent' | 'ancien'>('recent');
  let intervalleHistorique = $state<'7j' | '30j' | '3m' | '6m' | 'tout'>('7j');
  let historiqueDateDebut = $state('');
  let historiqueDateFin = $state('');
  let showDatePicker = $state(false);

  function formatDateHeader(dateStr: string) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (dateStr === today) return "Aujourd'hui";
    if (dateStr === yesterday) return 'Hier';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  const historiquesFiltres = $derived.by(() => {
    let liste = [...data.historiques];

    if (intervalleHistorique !== 'tout') {
      const now = new Date();
      let debut: Date;
      if (intervalleHistorique === '7j') debut = new Date(now.getTime() - 7 * 86400_000);
      else if (intervalleHistorique === '30j') debut = new Date(now.getTime() - 30 * 86400_000);
      else if (intervalleHistorique === '3m')
        debut = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      else debut = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      liste = liste.filter((h) => new Date(h.date_modification) >= debut);
    }

    if (historiqueDateDebut)
      liste = liste.filter((h) => h.date_modification >= historiqueDateDebut);
    if (historiqueDateFin)
      liste = liste.filter((h) => h.date_modification <= historiqueDateFin + 'T23:59:59');

    return liste.sort((a, b) => {
      const cmp = new Date(a.date_modification).getTime() - new Date(b.date_modification).getTime();
      return triHistorique === 'recent' ? -cmp : cmp;
    });
  });

  const historiqueGroupes = $derived.by(() => {
    const groups: Record<string, typeof historiquesFiltres> = {};
    for (const h of historiquesFiltres) {
      const dateKey = h.date_modification.slice(0, 10);
      (groups[dateKey] ??= []).push(h);
    }
    return Object.entries(groups).map(([date, items]) => ({
      date,
      items,
      net: items.reduce((s, h) => s + (h.nouvelle_valeur - h.ancienne_valeur), 0),
    }));
  });

  let stopHold = () => {};

  function onHoldStart(fn: () => void) {
    stopHold = startHold(fn);
  }

  function onHoldEnd() {
    stopHold();
  }

  const handleAjust = () => {
    return async ({
      result,
      update,
    }: {
      result: { type: string };
      update: () => Promise<void>;
    }) => {
      if (result.type === 'success') {
        popoverModele = null;
        await update();
      }
    };
  };

  // Pré-remplit la date d'échéance à partir d'un raccourci (sans muter d'instance Date).
  function appliquerRaccourci(intervalle: '6mois' | '1an' | '2ans') {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const day = now.getDate();
    const target =
      intervalle === '6mois'
        ? new Date(y, m + 6, day)
        : intervalle === '1an'
          ? new Date(y + 1, m, day)
          : new Date(y + 2, m, day);
    dateValeur = target.toISOString().split('T')[0];
  }
</script>

<!-- ── PAGE ──────────────────────────────────────────────────────────────── -->
<div
  class="w-full max-w-7xl mx-auto p-4 lg:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700"
>
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4">
      <div class="p-3 rounded-2xl bg-yellow-500 shadow-lg">
        <Boxes class="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 class="text-2xl lg:text-3xl font-black text-yellow-900 tracking-tight">
          Stocks &amp; Inventaire
        </h1>
        <p class="text-sm text-slate-500">Gestion des EPI et de leurs stocks</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick={() => (panneauHistorique = true)}
        class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-yellow-200 text-yellow-700 bg-white text-sm font-bold hover:bg-yellow-50 transition-colors"
      >
        <History class="w-4 h-4" />Historique
      </button>
      <button
        onclick={ouvrirCreation}
        class="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-yellow-500 text-white text-sm font-bold hover:bg-yellow-600 transition-colors shadow-lg"
      >
        <Plus class="w-4 h-4" />Nouvelle référence EPI
      </button>
    </div>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl flex items-center gap-4"
      style="background: linear-gradient(90deg, #a16207 0%, #ca8a04 100%)"
    >
      <Boxes class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0"
        >{stats.totalModeles}</span
      >
      <p class="text-yellow-200 text-sm font-bold leading-snug">Références EPI</p>
    </div>

    <div
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl flex items-center gap-4"
      style="background: linear-gradient(90deg, #ca8a04 0%, #eab308 100%)"
    >
      <CircleCheck class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0"
        >{stats.disponibles}</span
      >
      <p class="text-yellow-100 text-sm font-bold leading-snug">Unités disponibles</p>
    </div>

    <div
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl flex items-center gap-4"
      style="background: linear-gradient(90deg, #eab308 0%, #facc15 100%)"
    >
      <UserCheck class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0"
        >{stats.attribues}</span
      >
      <p class="text-yellow-100 text-sm font-bold leading-snug">Unités attribuées</p>
    </div>

    <div
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl flex items-center gap-4"
      style={stats.alertes > 0
        ? 'background: linear-gradient(90deg, #b91c1c 0%, #dc2626 100%)'
        : 'background: linear-gradient(90deg, #eab308 0%, #facc15 100%)'}
    >
      <TriangleAlert class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0"
        >{stats.alertes}</span
      >
      <p
        class="text-sm font-bold leading-snug {stats.alertes > 0
          ? 'text-red-100'
          : 'text-yellow-100'}"
      >
        Alertes stock
      </p>
    </div>
  </div>

  <!-- Barre de filtres -->
  <div class="flex flex-col sm:flex-row gap-3">
    <div class="relative flex-1">
      <Search
        class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        bind:value={recherche}
        placeholder="Rechercher par désignation ou type…"
        class="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm font-medium shadow-sm focus:border-transparent focus:ring-2 focus:ring-yellow-400 focus:outline-none"
      />
    </div>
    <select
      bind:value={filtreType}
      class="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 min-w-40"
    >
      <option value="">Tous les types</option>
      {#each allTypes as t (t)}
        <option value={t}>{t}</option>
      {/each}
    </select>
    <select
      bind:value={filtreAlerte}
      class="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 min-w-40"
    >
      <option value="">Toutes les alertes</option>
      <option value="alerte">En alerte</option>
      <option value="rupture">Rupture</option>
      <option value="ok">OK</option>
    </select>
  </div>

  <!-- Tableau -->
  <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
    <!-- En-têtes -->
    <div
      class="grid items-center gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50"
      style="grid-template-columns: 1.4fr 130px 80px 110px 120px 90px 56px"
    >
      {#snippet sortBtn(col: SortCol, label: string, center = false)}
        <button
          onclick={() => toggleSort(col)}
          class="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest transition-colors
            {triColonne === col ? 'text-yellow-600' : 'text-slate-400 hover:text-slate-600'}
            {center ? 'justify-center' : ''}"
        >
          {label}
          {#if triColonne === col}
            {#if triAsc}
              <ChevronUp class="w-3 h-3" />
            {:else}
              <ChevronDown class="w-3 h-3" />
            {/if}
          {:else}
            <ChevronsUpDown class="w-3 h-3 opacity-40" />
          {/if}
        </button>
      {/snippet}

      {@render sortBtn('designation', 'Désignation')}
      {@render sortBtn('type', 'Type', true)}
      {@render sortBtn('taille', 'Taille', true)}
      <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 text-center">
        Unités
      </p>
      <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 text-center">
        Stock
      </p>
      <div class="flex justify-center">
        {@render sortBtn('alerte', 'Alerte', true)}
      </div>
      <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 text-center">
        Actions
      </p>
    </div>

    {#if modelesFiltres.length === 0}
      <div class="flex flex-col items-center justify-center gap-3 py-16 opacity-30">
        <Boxes class="w-12 h-12 text-slate-400" />
        <p class="text-xs font-bold uppercase tracking-widest">Aucun EPI trouvé</p>
      </div>
    {/if}

    <div class="divide-y divide-gray-100">
      {#each modelesVisibles as modele (modele.id_modele_epi)}
        {@const dispo = disponiblesParModele[modele.id_modele_epi] ?? 0}
        {@const pct = modele.stock_total > 0 ? Math.round((dispo / modele.stock_total) * 100) : 0}
        {@const badge = getBadgeAlerte(modele, dispo)}
        <div
          class="grid items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group"
          style="grid-template-columns: 1.4fr 130px 80px 110px 120px 90px 56px"
        >
          <!-- Désignation -->
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-yellow-500 flex items-center justify-center shrink-0">
              <Package class="w-4 h-4 text-white" />
            </div>
            <p class="font-semibold text-sm text-slate-900 truncate">{modele.designation}</p>
          </div>

          <!-- Type -->
          <div class="flex justify-center">
            <span
              class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600"
            >
              {modele.type}
            </span>
          </div>

          <!-- Taille -->
          <div class="flex justify-center">
            {#if modele.taille}
              <span
                class="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600"
              >
                {modele.taille}
              </span>
            {:else}
              <span class="text-xs text-slate-300">—</span>
            {/if}
          </div>

          <!-- Unités -->
          <div class="relative flex items-center justify-center w-full text-sm tabular-nums">
            <span class="font-semibold text-slate-700">{dispo}</span>
            <span class="text-slate-400 font-normal">&nbsp;/ {modele.stock_total}</span>
            <button
              type="button"
              onclick={(e) => ouvrirPopover(e, modele)}
              class="absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-yellow-100 hover:bg-yellow-200 text-yellow-700"
              title="Ajuster le stock"
            >
              <Pencil class="w-3 h-3" />
            </button>
          </div>

          <!-- Stock (barre) -->
          <div class="flex justify-center">
            <div class="w-24 bg-gray-200 rounded-full h-2">
              <div
                class="h-2 rounded-full transition-all"
                style="width: {pct}%"
                class:bg-red-500={badge.label === 'Rupture'}
                class:bg-orange-500={badge.label === 'Critique'}
                class:bg-yellow-400={badge.label === 'Bas'}
                class:bg-emerald-500={badge.label === 'OK'}
              ></div>
            </div>
          </div>

          <!-- Alerte -->
          <div class="flex justify-center">
            <span
              class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold {badge.class}"
            >
              {badge.label}
            </span>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-center gap-1">
            <button
              onclick={() => ouvrirEdition(modele)}
              class="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg hover:bg-yellow-50 text-slate-400 hover:text-yellow-600"
              title="Éditer"
            >
              <Pencil class="w-4 h-4" />
            </button>
            <form
              method="POST"
              action="?/supprimerModele"
              class="opacity-0 group-hover:opacity-100 transition-opacity"
              use:enhance={async ({ cancel }) => {
                const ok = await confirmAction({
                  title: 'Supprimer la référence',
                  message: `Supprimer "${modele.designation}" et toutes ses unités ? Cette action est irréversible.`,
                  confirmLabel: 'Supprimer',
                  confirmVariant: 'danger',
                });
                if (!ok) {
                  cancel();
                  return;
                }
                return ({ update }) => update();
              }}
            >
              <input type="hidden" name="id_modele_epi" value={modele.id_modele_epi} />
              <button
                type="submit"
                class="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="Supprimer"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      {/each}
      <InfiniteScrollSentinel
        hasMore={visibleCount < modelesFiltres.length}
        onLoadMore={() => (visibleCount += PAGE_SIZE)}
      />
    </div>
  </div>
</div>

<!-- ── PANNEAU CRÉATION / ÉDITION ──────────────────────────────────────────── -->
{#if panneauOuvert}
  <button
    transition:fade={{ duration: 200 }}
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
    onclick={() => (panneauOuvert = false)}
    aria-label="Fermer"
  ></button>

  <div
    in:fly={{ x: 500, duration: 350, easing: quintOut }}
    out:fly={{ x: 500, duration: 250, easing: cubicIn }}
    class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-120 bg-white shadow-2xl flex flex-col overflow-hidden"
  >
    <!-- En-tête -->
    <div
      class="p-6 bg-linear-to-br from-yellow-600 to-yellow-500 relative overflow-hidden shrink-0"
    >
      <Boxes class="absolute -right-4 -bottom-4 w-32 h-32 text-white/5" />
      <div class="relative z-10 flex items-start justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div
            class="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center"
          >
            <Package class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-lg font-bold text-white">
              {modeleEnEdition ? 'Modifier la référence' : 'Nouvelle référence EPI'}
            </h2>
            <p class="text-yellow-100 text-xs mt-0.5">
              {modeleEnEdition
                ? 'Mettre à jour les informations'
                : 'Créer une référence EPI et ses unités'}
            </p>
          </div>
        </div>
        <button
          onclick={() => (panneauOuvert = false)}
          class="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
        >
          <X class="w-4.5 h-4.5" />
        </button>
      </div>
    </div>

    <!-- Formulaire -->
    <form
      method="POST"
      action={modeleEnEdition ? '?/modifierModele' : '?/ajouterModeleEtUnites'}
      use:enhance={() => {
        loading = true;
        return ({ update }) => {
          loading = false;
          panneauOuvert = false;
          update();
        };
      }}
      class="flex-1 overflow-y-auto flex flex-col bg-slate-50/60"
    >
      {#if modeleEnEdition}
        <input type="hidden" name="id_modele_epi" value={modeleEnEdition.id_modele_epi} />
      {/if}

      <div class="flex-1 p-5 space-y-4">
        <!-- Section 1 — Identité -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <p class="text-[11px] font-bold uppercase tracking-widest text-yellow-600">
            Identification
          </p>
          <div class="space-y-1.5">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Désignation <span class="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="designation"
              bind:value={fDesignation}
              required
              placeholder="ex : Casque de chantier"
              class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-500 focus:bg-white transition-all"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Type <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="type"
                bind:value={fType}
                required
                list="stock-types"
                placeholder="ex : Protection tête"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-500 focus:bg-white transition-all"
              />
              <datalist id="stock-types">
                {#each allTypes as t (t)}
                  <option value={t}></option>
                {/each}
              </datalist>
            </div>
            <div class="space-y-1.5">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Taille
              </label>
              <input
                type="text"
                name="taille"
                bind:value={fTaille}
                placeholder="ex : M, L, 42…"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-500 focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>

        <!-- Section 2 — Stock -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <p class="text-[11px] font-bold uppercase tracking-widest text-yellow-600">
            Gestion du stock
          </p>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Stock total <span class="text-red-400">*</span>
              </label>
              <input
                type="number"
                name="stock_total"
                bind:value={fStockTotal}
                min="1"
                required
                class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-500 focus:bg-white transition-all"
              />
            </div>
            <div class="space-y-1.5">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Seuil d'alerte <span class="text-red-400">*</span>
              </label>
              <input
                type="number"
                name="seuil_alerte"
                bind:value={fSeuilAlerte}
                min="1"
                required
                class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-500 focus:bg-white transition-all"
              />
            </div>
          </div>
          {#if !modeleEnEdition}
            <div class="space-y-1.5">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Quantité initiale <span class="text-red-400">*</span>
              </label>
              <input
                type="number"
                name="quantite_initiale"
                bind:value={fQuantiteInitiale}
                min="0"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-500 focus:bg-white transition-all"
              />
              <p class="text-xs text-slate-400">
                Ce nombre d'unités EPI physiques sera créé et associé à cette référence.
              </p>
            </div>
          {/if}
        </div>

        <!-- Section 3 — Échéance (création uniquement) -->
        {#if !modeleEnEdition && fQuantiteInitiale > 0}
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            <p class="text-[11px] font-bold uppercase tracking-widest text-yellow-600">
              Échéance &amp; contrôle
            </p>
            <input type="hidden" name="mode_echeance" value={modeEcheance} />

            <!-- Toggle -->
            <div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onclick={() => setMode('expiration')}
                class:bg-white={modeEcheance === 'expiration'}
                class:shadow-sm={modeEcheance === 'expiration'}
                class:text-yellow-700={modeEcheance === 'expiration'}
                class="rounded-lg py-2 px-3 text-sm font-medium transition-all text-slate-500"
              >
                📅 Date d'expiration
              </button>
              <button
                type="button"
                onclick={() => setMode('controle')}
                class:bg-white={modeEcheance === 'controle'}
                class:shadow-sm={modeEcheance === 'controle'}
                class:text-yellow-700={modeEcheance === 'controle'}
                class="rounded-lg py-2 px-3 text-sm font-medium transition-all text-slate-500"
              >
                🔧 Prochain contrôle
              </button>
            </div>

            {#if modeEcheance === 'expiration'}
              <div class="space-y-3" in:fly={{ x: -20, duration: 220, easing: quintOut }}>
                <div class="space-y-1.5">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    Date d'expiration <span class="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    name="date_valeur"
                    bind:value={dateValeur}
                    required
                    class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            {:else}
              <div class="space-y-3" in:fly={{ x: 20, duration: 220, easing: quintOut }}>
                <div class="space-y-1.5">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    Prochain contrôle <span class="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    name="date_valeur"
                    bind:value={dateValeur}
                    required
                    class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            {/if}

            <!-- Raccourcis -->
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-slate-400 shrink-0">— ou choisir —</span>
              <div class="flex gap-2 flex-1">
                {#each [['6mois', '6 mois'], ['1an', '1 an'], ['2ans', '2 ans']] as [val, label] (val)}
                  <button
                    type="button"
                    onclick={() => appliquerRaccourci(val as '6mois' | '1an' | '2ans')}
                    class="flex-1 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-semibold hover:bg-yellow-100 transition-colors"
                  >
                    {label}
                  </button>
                {/each}
              </div>
            </div>

            {#if modeEcheance === 'controle'}
              <div class="space-y-1.5">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Commentaire
                </label>
                <textarea
                  name="commentaire"
                  bind:value={fCommentaire}
                  rows="2"
                  placeholder="Optionnel…"
                  class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-500 focus:bg-white transition-all resize-none"
                ></textarea>
              </div>
            {/if}

            <!-- Note -->
            <div
              class="flex items-start gap-2 rounded-xl bg-yellow-50 border border-yellow-100 px-3.5 py-3"
            >
              <Info class="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              <p class="text-xs text-yellow-700">
                Chaque unité créée sera soit soumise à une date d'expiration, soit à un cycle de
                contrôle — pas les deux.
              </p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Section 4 — Actions -->
      <div class="shrink-0 px-5 py-4 border-t border-slate-200 bg-white flex items-center gap-3">
        <button
          type="button"
          onclick={() => (panneauOuvert = false)}
          class="px-5 py-3 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          class="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-yellow-500 text-white text-sm font-bold hover:bg-yellow-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if loading}
            Enregistrement…
          {:else if modeleEnEdition}
            Enregistrer les modifications
          {:else}
            Créer la référence &amp; ses unités →
          {/if}
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- ── POPOVER AJUSTEMENT STOCK ───────────────────────────────────────────── -->
{#if popoverModele}
  <div class="fixed inset-0 z-40" onclick={() => (popoverModele = null)}></div>

  <div
    class="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-72"
    style="top: {popoverY}px; left: {popoverX}px"
    transition:fly={{ y: -8, duration: 150 }}
  >
    <p class="font-semibold text-gray-800 text-sm mb-1">{popoverModele.designation}</p>
    <p class="text-xs text-gray-400 mb-3">Stock actuel : {popoverModele.stock_total} unités</p>

    <!-- Contrôle +/- -->
    <div class="flex items-center gap-2 mb-3">
      <button
        type="button"
        onpointerdown={() => onHoldStart(() => deltaInput--)}
        onpointerup={onHoldEnd}
        onpointerleave={onHoldEnd}
        class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold leading-none transition-colors select-none"
        >−</button
      >

      <input
        type="number"
        bind:value={deltaInput}
        class="flex-1 border border-gray-200 rounded-lg py-1.5 text-center text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400"
      />

      <button
        type="button"
        onpointerdown={() => onHoldStart(() => deltaInput++)}
        onpointerup={onHoldEnd}
        onpointerleave={onHoldEnd}
        class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold leading-none transition-colors select-none"
        >+</button
      >
    </div>

    <!-- Résultat calculé -->
    <p
      class="text-xs mb-3"
      class:text-emerald-600={nouveauStock > popoverModele.stock_total}
      class:text-red-500={nouveauStock < popoverModele.stock_total || nouveauStock < 0}
      class:text-gray-400={deltaInput === 0}
    >
      → Nouveau stock : <strong>{nouveauStock}</strong>
      {#if nouveauStock < 0}<span> (invalide)</span>{/if}
    </p>

    <!-- Motif -->
    <input
      type="text"
      bind:value={motifInput}
      placeholder="Motif (optionnel)"
      class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400"
    />

    <!-- Actions -->
    <form method="POST" action="?/ajusterStock" use:enhance={handleAjust}>
      <input type="hidden" name="id" value={popoverModele.id_modele_epi} />
      <input type="hidden" name="delta" value={deltaInput} />
      <input type="hidden" name="motif" value={motifInput} />

      <div class="flex gap-2">
        <button
          type="button"
          onclick={() => (popoverModele = null)}
          class="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
          >Annuler</button
        >
        <button
          type="submit"
          disabled={deltaInput === 0 || nouveauStock < 0}
          class="flex-1 px-3 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >Appliquer</button
        >
      </div>
    </form>
  </div>
{/if}

<!-- ── PANNEAU HISTORIQUE ──────────────────────────────────────────────────── -->
{#if panneauHistorique}
  <button
    transition:fade={{ duration: 200 }}
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
    onclick={() => (panneauHistorique = false)}
    aria-label="Fermer"
  ></button>

  <div
    in:fly={{ x: 500, duration: 350, easing: quintOut }}
    out:fly={{ x: 500, duration: 250, easing: cubicIn }}
    class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-120 bg-white shadow-2xl flex flex-col overflow-hidden"
  >
    <!-- Header -->
    <div
      class="p-6 bg-linear-to-br from-yellow-600 to-yellow-500 relative overflow-hidden shrink-0"
    >
      <History class="absolute -right-4 -bottom-4 w-32 h-32 text-white/5" />
      <div class="relative z-10 flex items-start justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div
            class="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center"
          >
            <History class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-lg font-bold text-white">Historique des stocks</h2>
            <p class="text-yellow-100 text-xs mt-0.5">
              {historiquesFiltres.length} mouvement{historiquesFiltres.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onclick={() => (panneauHistorique = false)}
          class="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
        >
          <X class="w-4.5 h-4.5" />
        </button>
      </div>
    </div>

    <!-- Résumé -->
    {#if historiquesFiltres.length > 0}
      {@const totalIn = historiquesFiltres
        .filter((h) => h.nouvelle_valeur > h.ancienne_valeur)
        .reduce((s, h) => s + (h.nouvelle_valeur - h.ancienne_valeur), 0)}
      {@const totalOut = historiquesFiltres
        .filter((h) => h.nouvelle_valeur < h.ancienne_valeur)
        .reduce((s, h) => s + (h.ancienne_valeur - h.nouvelle_valeur), 0)}
      {@const net = totalIn - totalOut}
      <div class="shrink-0 flex items-center px-6 py-3.5 border-b border-slate-100 text-center">
        <div class="flex-1">
          <span class="text-base font-bold text-emerald-600 tabular-nums">+{totalIn}</span>
          <span class="block text-[11px] text-slate-400">entrées</span>
        </div>
        <div class="w-px h-7 bg-slate-100"></div>
        <div class="flex-1">
          <span class="text-base font-bold text-red-500 tabular-nums">−{totalOut}</span>
          <span class="block text-[11px] text-slate-400">sorties</span>
        </div>
        <div class="w-px h-7 bg-slate-100"></div>
        <div class="flex-1">
          <span
            class="text-base font-bold tabular-nums {net >= 0 ? 'text-slate-700' : 'text-red-500'}"
            >{net >= 0 ? '+' : '−'}{Math.abs(net)}</span
          >
          <span class="block text-[11px] text-slate-400">net</span>
        </div>
      </div>
    {/if}

    <!-- Contrôles -->
    <div class="shrink-0 px-5 py-3 flex items-center gap-1.5 border-b border-slate-100">
      <button
        onclick={() => (triHistorique = triHistorique === 'recent' ? 'ancien' : 'recent')}
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors shrink-0
          {triHistorique === 'recent'
          ? 'border-yellow-500 bg-yellow-500 text-white'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50'}"
      >
        {#if triHistorique === 'recent'}
          <ArrowDown class="w-3 h-3" />Récent
        {:else}
          <ArrowUp class="w-3 h-3" />Ancien
        {/if}
      </button>

      <div class="flex bg-slate-100 rounded-lg p-0.5 flex-1">
        {#each [['7j', '7j'], ['30j', '30j'], ['3m', '3m'], ['tout', 'Tout']] as [val, label] (val)}
          <button
            onclick={() => {
              intervalleHistorique = val as typeof intervalleHistorique;
              historiqueDateDebut = '';
              historiqueDateFin = '';
              showDatePicker = false;
            }}
            class="flex-1 py-1 rounded-md text-xs font-medium transition-all
              {intervalleHistorique === val && !showDatePicker
              ? 'bg-white text-yellow-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'}"
          >
            {label}
          </button>
        {/each}
      </div>

      <button
        onclick={() => {
          showDatePicker = !showDatePicker;
          if (showDatePicker) intervalleHistorique = 'tout';
          else {
            historiqueDateDebut = '';
            historiqueDateFin = '';
          }
        }}
        class="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors shrink-0
          {showDatePicker
          ? 'border-yellow-400 bg-yellow-50 text-yellow-600'
          : 'border-slate-200 text-slate-400 hover:bg-slate-50'}"
      >
        <CalendarRange class="w-3.5 h-3.5" />
      </button>
    </div>

    {#if showDatePicker}
      <div
        class="shrink-0 flex items-center gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50"
        transition:slide={{ duration: 160 }}
      >
        <input
          type="date"
          bind:value={historiqueDateDebut}
          class="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-300"
        />
        <span class="text-slate-300 text-xs">→</span>
        <input
          type="date"
          bind:value={historiqueDateFin}
          class="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-300"
        />
      </div>
    {/if}

    {#if historiquesFiltres.length === 0}
      <div class="flex-1 flex flex-col items-center justify-center gap-2 text-slate-300">
        <History class="w-8 h-8" />
        <p class="text-xs font-medium">Aucun mouvement</p>
      </div>
    {:else}
      <!-- En-têtes de colonnes -->
      <div
        class="shrink-0 grid items-center gap-3 px-6 py-2 border-b border-slate-100"
        style="grid-template-columns: 1fr 70px 52px"
      >
        <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400"
          >Article</span
        >
        <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right"
          >Stock</span
        >
        <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right"
          >Mvt</span
        >
      </div>

      <!-- Mouvements groupés par date -->
      <div class="flex-1 overflow-y-auto">
        {#each historiqueGroupes as groupe (groupe.date)}
          <!-- Bandeau de jour (sticky) -->
          <div
            class="sticky top-0 z-10 flex items-center justify-between px-6 py-1.5 bg-slate-100/95 backdrop-blur-sm border-y border-slate-200/50"
          >
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 capitalize">
              {formatDateHeader(groupe.date)}
            </span>
            <span
              class="text-[11px] font-semibold tabular-nums {groupe.net >= 0
                ? 'text-emerald-600'
                : 'text-red-500'}"
            >
              net {groupe.net >= 0 ? '+' : '−'}{Math.abs(groupe.net)}
            </span>
          </div>

          <!-- Lignes -->
          {#each groupe.items as h (h.id_historique)}
            {@const hausse = h.nouvelle_valeur > h.ancienne_valeur}
            {@const delta = h.nouvelle_valeur - h.ancienne_valeur}
            {@const designation = Array.isArray(h.modele_epi)
              ? h.modele_epi[0]?.designation
              : h.modele_epi?.designation}
            <div
              class="grid items-center gap-3 px-6 py-2.5 border-b border-slate-50 hover:bg-yellow-50/40 transition-colors"
              style="grid-template-columns: 1fr 70px 52px"
            >
              <!-- Flèche + désignation + motif -->
              <div class="flex items-center gap-2.5 min-w-0">
                <div
                  class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 {hausse
                    ? 'bg-emerald-50'
                    : 'bg-red-50'}"
                >
                  {#if hausse}
                    <ArrowUp class="w-3.5 h-3.5 text-emerald-500" />
                  {:else}
                    <ArrowDown class="w-3.5 h-3.5 text-red-400" />
                  {/if}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-800 truncate leading-tight">
                    {designation ?? '—'}
                  </p>
                  {#if h.motif}
                    <p class="text-[11px] text-slate-400 truncate leading-tight">{h.motif}</p>
                  {/if}
                </div>
              </div>

              <!-- Stock : ancien → nouveau -->
              <div class="text-right text-xs tabular-nums whitespace-nowrap">
                <span class="text-slate-300">{h.ancienne_valeur}</span>
                <span class="text-slate-300">→</span>
                <span class="font-bold text-slate-600">{h.nouvelle_valeur}</span>
              </div>

              <!-- Mouvement (delta) -->
              <span
                class="text-right text-sm font-black tabular-nums {hausse
                  ? 'text-emerald-600'
                  : 'text-red-500'}"
              >
                {hausse ? '+' : '−'}{Math.abs(delta)}
              </span>
            </div>
          {/each}
        {/each}
      </div>
    {/if}
  </div>
{/if}
