<script lang="ts">
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { confirmAction } from '$lib/stores/confirm';
  import { page } from '$app/stores';
  import { fly, fade } from 'svelte/transition';
  import { quintOut, cubicIn } from 'svelte/easing';
  import {
    ArrowRightLeft,
    Package,
    Users,
    UserCheck,
    Plus,
    X,
    Search,
    Save,
    Trash2,
    RotateCcw,
    ExternalLink,
    Clock,
    CircleCheck,
    Undo2,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
  } from 'lucide-svelte';

  let { data }: { data: PageData } = $props();

  // ── Helpers ───────────────────────────────────────────────────────────
  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';

  // Affichage relatif comme la section "Activité récente" du Dashboard.
  const relativeDate = (d: string) => {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days <= 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 30) return `Il y a ${days} j`;
    return formatDate(d);
  };

  const initials = (_prenom: string, nom: string) => (nom?.trim()?.[0] ?? '?').toUpperCase();

  const epiLabel = (e: { designation: string; type: string; taille: string | null }) =>
    `${e.designation}${e.taille ? ` · ${e.taille}` : ''} — ${e.type}`;

  // ── Stats ─────────────────────────────────────────────────────────────
  const monthPrefix = new Date().toISOString().slice(0, 7); // "AAAA-MM"
  const stats = $derived({
    total: data.attributions.length,
    actives: data.attributions.filter((a) => !a.date_retour).length,
    retournees: data.attributions.filter((a) => a.date_retour).length,
    ceMois: data.attributions.filter((a) => a.date_attribution?.startsWith(monthPrefix)).length,
  });

  // ── Filtres ───────────────────────────────────────────────────────────
  let search = $state('');
  let filterChauffeur = $state('');
  let filterType = $state('');
  let filterStatut = $state<'' | 'active' | 'returned' | 'month'>('');

  const allTypes = $derived(
    [...new Set(data.attributions.map((a) => a.type).filter((t) => t && t !== '—'))].sort(),
  );

  const filtered = $derived.by(() => {
    const q = search.toLowerCase();
    const rows = data.attributions.filter((a) => {
      const name = `${a.chauffeur_prenom} ${a.chauffeur_nom}`.toLowerCase();
      if (q && !name.includes(q) && !a.designation.toLowerCase().includes(q)) return false;
      if (filterChauffeur && a.id_chauffeur !== filterChauffeur) return false;
      if (filterType && a.type !== filterType) return false;
      if (filterStatut === 'active' && a.date_retour) return false;
      if (filterStatut === 'returned' && !a.date_retour) return false;
      if (filterStatut === 'month' && !a.date_attribution?.startsWith(monthPrefix)) return false;
      return true;
    });

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'chauffeur')
        cmp = `${a.chauffeur_nom} ${a.chauffeur_prenom}`.localeCompare(
          `${b.chauffeur_nom} ${b.chauffeur_prenom}`,
          'fr',
        );
      else if (sortCol === 'epi') cmp = a.designation.localeCompare(b.designation, 'fr');
      else if (sortCol === 'taille') cmp = (a.taille ?? '').localeCompare(b.taille ?? '', 'fr');
      else if (sortCol === 'attribution')
        cmp = (a.date_attribution ?? '').localeCompare(b.date_attribution ?? '');
      else if (sortCol === 'retour') cmp = (a.date_retour ?? '').localeCompare(b.date_retour ?? '');
      else if (sortCol === 'statut') cmp = (a.date_retour ? 1 : 0) - (b.date_retour ? 1 : 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  });

  const hasFilters = $derived(!!(search || filterChauffeur || filterType || filterStatut));

  function clearFilters() {
    search = '';
    filterChauffeur = '';
    filterType = '';
    filterStatut = '';
  }

  function toggleStatut(s: 'active' | 'returned' | 'month') {
    filterStatut = filterStatut === s ? '' : s;
  }

  // ── Panneau de détail ─────────────────────────────────────────────────
  let selectedAttrId = $state<string | null>(null);
  const selectedAttr = $derived(
    selectedAttrId
      ? (data.attributions.find((a) => a.id_attribution === selectedAttrId) ?? null)
      : null,
  );

  let confirmDelete = $state(false);
  let editChauffeurId = $state('');
  let editModeleId = $state('');
  let editEpiSearch = $state('');
  let showEditEpiDropdown = $state(false);

  let showEditForm = $state(false);

  function openAttr(id: string) {
    selectedAttrId = id;
    confirmDelete = false;
    showEditForm = false;
    showEditEpiDropdown = false;
    const a = data.attributions.find((x) => x.id_attribution === id);
    editChauffeurId = a?.id_chauffeur ?? '';
    editModeleId = a?.id_modele_epi ?? '';
    editEpiSearch = a ? epiLabel(a) : '';
  }

  const filteredEditEpi = $derived.by(() => {
    if (!editEpiSearch.trim()) return editModeleOptions;
    const q = editEpiSearch.toLowerCase();
    return editModeleOptions.filter(
      (e) =>
        e.designation.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        (e.taille ?? '').toLowerCase().includes(q),
    );
  });

  // Options du select modèle en édition : le modèle courant + tous les modèles disponibles.
  const editModeleOptions = $derived.by(() => {
    if (!selectedAttr) return data.episDisponibles;
    const exists = data.episDisponibles.some((e) => e.id_modele_epi === selectedAttr.id_modele_epi);
    if (exists) return data.episDisponibles;
    return [
      {
        id_modele_epi: selectedAttr.id_modele_epi,
        designation: selectedAttr.designation,
        type: selectedAttr.type,
        taille: selectedAttr.taille,
        stock_total: 0,
        stock_dispo: 0,
      },
      ...data.episDisponibles,
    ];
  });

  // ── Panneau de création ───────────────────────────────────────────────
  let showCreate = $state(false);
  let createChauffeurId = $state('');
  let createChauffeurSearch = $state('');
  let showChauffeurDropdown = $state(false);
  let createEpiLines = $state<{ id: string; search: string; open: boolean }[]>([
    { id: '', search: '', open: false },
  ]);

  const filteredCreateChauffeurs = $derived(
    createChauffeurSearch.trim()
      ? data.chauffeurs.filter((c) =>
          `${c.nom} ${c.prenom}`.toLowerCase().includes(createChauffeurSearch.toLowerCase()),
        )
      : data.chauffeurs,
  );

  const selectedChauffeurLabel = $derived(
    createChauffeurId
      ? (data.chauffeurs.find((c) => c.id_chauffeur === createChauffeurId) ?? null)
      : null,
  );

  function selectChauffeur(id: string, prenom: string, nom: string) {
    createChauffeurId = id;
    createChauffeurSearch = `${nom} ${prenom}`;
    showChauffeurDropdown = false;
  }

  function openCreate(prefillChauffeurId = '') {
    showCreate = true;
    showChauffeurDropdown = false;
    createEpiLines = [{ id: '', search: '', open: false }];
    if (prefillChauffeurId) {
      const c = data.chauffeurs.find((ch) => ch.id_chauffeur === prefillChauffeurId);
      createChauffeurId = prefillChauffeurId;
      createChauffeurSearch = c ? `${c.nom} ${c.prenom}` : '';
    } else {
      createChauffeurId = '';
      createChauffeurSearch = '';
    }
  }

  let handledFiche = $state<string | null>(null);
  $effect(() => {
    const fiche = $page.url.searchParams.get('fiche');
    if (
      fiche &&
      fiche !== handledFiche &&
      data.attributions.some((a) => a.id_attribution === fiche)
    ) {
      handledFiche = fiche;
      openAttr(fiche);
    }
  });

  let handledChauffeurParam = $state<string | null>(null);
  $effect(() => {
    const chauffeurParam = $page.url.searchParams.get('chauffeur');
    if (
      chauffeurParam &&
      chauffeurParam !== handledChauffeurParam &&
      data.chauffeurs.some((c) => c.id_chauffeur === chauffeurParam)
    ) {
      handledChauffeurParam = chauffeurParam;
      openCreate(chauffeurParam);
    }
  });

  function addEpiLine() {
    createEpiLines = [...createEpiLines, { id: '', search: '', open: false }];
  }

  function removeEpiLine(i: number) {
    createEpiLines = createEpiLines.filter((_, idx) => idx !== i);
  }

  function filteredEpi(lineIndex: number, query: string) {
    const othersSelected = new Set(
      createEpiLines.filter((l, idx) => idx !== lineIndex && l.id).map((l) => l.id),
    );
    const available = data.episDisponibles.filter((e) => !othersSelected.has(e.id_modele_epi));
    if (!query.trim()) return available;
    const q = query.toLowerCase();
    return available.filter(
      (e) =>
        e.designation.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        (e.taille ?? '').toLowerCase().includes(q),
    );
  }

  function selectEpi(i: number, modeleId: string, label: string) {
    createEpiLines[i].id = modeleId;
    createEpiLines[i].search = label;
    createEpiLines[i].open = false;
  }

  const createIsValid = $derived(!!createChauffeurId && createEpiLines.some((l) => l.id));

  // ── Navigation vers les fiches dédiées ────────────────────────────────
  function voirChauffeur(id: string) {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(`${resolve('/chauffeurs')}?fiche=${id}`);
  }
  function voirEpi(id: string) {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(`${resolve('/epi')}?fiche=${id}`);
  }

  const GRID = 'grid-template-columns: 1.2fr 1.4fr 70px 120px 150px 110px 56px';

  type SortCol = 'chauffeur' | 'epi' | 'taille' | 'attribution' | 'retour' | 'statut';
  let sortCol = $state<SortCol>('attribution');
  let sortDir = $state<'asc' | 'desc'>('desc');

  function toggleSort(col: SortCol) {
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else {
      sortCol = col;
      sortDir = 'asc';
    }
  }
</script>

<!-- ── PAGE ──────────────────────────────────────────────────────────────── -->
<div
  class="mx-auto w-full max-w-7xl space-y-8 p-4 duration-700 animate-in fade-in slide-in-from-bottom-4 lg:p-10"
>
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4">
      <div class="rounded-2xl bg-emerald-600 p-3 shadow-lg">
        <ArrowRightLeft class="h-6 w-6 text-white" />
      </div>
      <h1 class="text-3xl font-black tracking-tight text-emerald-800 uppercase">Attributions</h1>
    </div>
    <button
      onclick={() => openCreate()}
      class="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-colors hover:bg-emerald-500"
    >
      <Plus class="h-4 w-4" />
      Nouvelle attribution
    </button>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <button
      onclick={clearFilters}
      class="relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 border-emerald-700 px-5 py-4 text-left shadow-xl transition-all"
      style="background: linear-gradient(90deg, #065f46 0%, #047857 100%)"
    >
      <ArrowRightLeft class="absolute -right-3 -bottom-3 h-20 w-20 text-white/10" />
      <span class="shrink-0 text-4xl leading-none font-black text-white tabular-nums"
        >{stats.total}</span
      >
      <p class="text-sm leading-snug font-bold text-emerald-100">Attributions au total</p>
    </button>

    <button
      onclick={() => toggleStatut('active')}
      class="relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 px-5 py-4 text-left shadow-xl transition-all
        {filterStatut === 'active'
        ? 'border-emerald-600 ring-2 ring-emerald-400'
        : 'border-emerald-500'}"
      style="background: linear-gradient(90deg, #059669 0%, #10b981 100%)"
    >
      <UserCheck class="absolute -right-3 -bottom-3 h-20 w-20 text-white/10" />
      <span class="shrink-0 text-4xl leading-none font-black text-white tabular-nums"
        >{stats.actives}</span
      >
      <p class="text-sm leading-snug font-bold text-emerald-100">Actives</p>
    </button>

    <button
      onclick={() => toggleStatut('returned')}
      class="relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 px-5 py-4 text-left shadow-xl transition-all
        {filterStatut === 'returned'
        ? 'border-emerald-400 ring-2 ring-emerald-300'
        : 'border-emerald-300'}"
      style="background: linear-gradient(90deg, #34d399 0%, #6ee7b7 100%)"
    >
      <Undo2 class="absolute -right-3 -bottom-3 h-20 w-20 text-emerald-700/20" />
      <span class="shrink-0 text-4xl leading-none font-black text-emerald-900 tabular-nums"
        >{stats.retournees}</span
      >
      <p class="text-sm leading-snug font-bold text-emerald-800">Retournées</p>
    </button>

    <button
      onclick={() => toggleStatut('month')}
      class="relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 px-5 py-4 text-left shadow-xl transition-all
        {filterStatut === 'month'
        ? 'border-emerald-300 ring-2 ring-emerald-200'
        : 'border-emerald-200'}"
      style="background: linear-gradient(90deg, #a7f3d0 0%, #d1fae5 100%)"
    >
      <Clock class="absolute -right-3 -bottom-3 h-20 w-20 text-emerald-400/30" />
      <span class="shrink-0 text-4xl leading-none font-black text-emerald-900 tabular-nums"
        >{stats.ceMois}</span
      >
      <p class="text-sm leading-snug font-bold text-emerald-700">Ce mois-ci</p>
    </button>
  </div>

  <!-- Barre de filtres -->
  <div class="flex flex-col gap-3 sm:flex-row">
    <div class="relative flex-1">
      <Search
        class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        bind:value={search}
        placeholder="Rechercher un chauffeur ou un EPI…"
        class="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm font-medium shadow-sm focus:border-transparent focus:ring-2 focus:ring-emerald-400 focus:outline-none"
      />
    </div>
    <select
      bind:value={filterChauffeur}
      class="min-w-44 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
    >
      <option value="">Tous les chauffeurs</option>
      {#each data.chauffeurs as c (c.id_chauffeur)}
        <option value={c.id_chauffeur}>{c.nom} {c.prenom}</option>
      {/each}
    </select>
    <select
      bind:value={filterType}
      class="min-w-40 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
    >
      <option value="">Tous les types</option>
      {#each allTypes as t (t)}
        <option value={t}>{t}</option>
      {/each}
    </select>
    {#if hasFilters}
      <button
        onclick={clearFilters}
        class="flex items-center gap-2 rounded-2xl bg-emerald-100 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-200"
      >
        <X class="h-3.5 w-3.5" />Effacer
      </button>
    {/if}
  </div>

  <!-- Tableau -->
  <div class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
    <!-- En-têtes -->
    <div
      class="grid items-center gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3"
      style={GRID}
    >
      {#snippet sortBtn(col: SortCol, label: string, center = false)}
        <button
          onclick={() => toggleSort(col)}
          class="flex items-center gap-1 text-[10px] font-black tracking-widest uppercase transition-colors
            {sortCol === col ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}
            {center ? 'justify-center' : ''}"
        >
          {label}
          {#if sortCol === col}
            {#if sortDir === 'asc'}<ChevronUp class="h-3 w-3" />{:else}<ChevronDown
                class="h-3 w-3"
              />{/if}
          {:else}
            <ChevronsUpDown class="h-3 w-3 opacity-40" />
          {/if}
        </button>
      {/snippet}

      {@render sortBtn('chauffeur', 'Chauffeur')}
      {@render sortBtn('epi', 'EPI')}
      {@render sortBtn('taille', 'Taille', true)}
      {@render sortBtn('attribution', 'Attribution')}
      {@render sortBtn('retour', 'Retour')}
      {@render sortBtn('statut', 'Statut', true)}
      <p class="text-center text-[10px] font-black tracking-widest text-slate-400 uppercase">
        Suppr.
      </p>
    </div>

    {#if filtered.length === 0}
      <div class="flex flex-col items-center justify-center gap-3 py-16 opacity-30">
        <ArrowRightLeft class="h-12 w-12 text-slate-400" />
        <p class="text-xs font-black tracking-widest uppercase">Aucune attribution trouvée</p>
      </div>
    {/if}

    {#each filtered as a (a.id_attribution)}
      {@const active = !a.date_retour}
      <div
        role="row"
        tabindex="0"
        onclick={() => openAttr(a.id_attribution)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && openAttr(a.id_attribution)}
        class="group grid cursor-pointer items-center gap-4 border-b border-slate-100 px-6 py-3.5 transition-colors hover:bg-emerald-50/40"
        style={GRID}
      >
        <!-- Chauffeur -->
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-xs font-black text-white"
          >
            {initials(a.chauffeur_prenom, a.chauffeur_nom)}
          </div>
          <p class="truncate text-sm font-bold text-slate-900">
            {a.chauffeur_nom}
            {a.chauffeur_prenom}
          </p>
        </div>

        <!-- EPI -->
        <div class="flex min-w-0 items-center gap-2.5">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-800">{a.designation}</p>
            <p class="truncate text-xs text-slate-400">{a.type}</p>
          </div>
        </div>

        <!-- Taille -->
        <div class="flex justify-center">
          {#if a.taille}
            <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
              >{a.taille}</span
            >
          {:else}
            <span class="text-xs text-slate-300">—</span>
          {/if}
        </div>

        <!-- Date d'attribution -->
        <p class="text-xs font-medium text-slate-500" title={formatDate(a.date_attribution)}>
          {relativeDate(a.date_attribution)}
        </p>

        <!-- Date de retour -->
        <div class="min-w-0">
          {#if a.date_retour}
            <p class="text-xs font-semibold text-slate-600">{formatDate(a.date_retour)}</p>
            {#if a.motif_retour}
              <p class="truncate text-[11px] text-slate-400">{a.motif_retour}</p>
            {/if}
          {:else}
            <span class="text-xs text-slate-300">—</span>
          {/if}
        </div>

        <!-- Statut -->
        <div class="flex justify-center">
          {#if active}
            <span
              class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Actif
            </span>
          {:else}
            <span
              class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500"
            >
              <Undo2 class="h-3 w-3" />Retourné
            </span>
          {/if}
        </div>

        <!-- Supprimer -->
        <div
          role="none"
          onclick={(e) => e.stopPropagation()}
          class="flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
        >
          <form
            method="POST"
            action="?/deleteAttribution"
            use:enhance={async ({ cancel }) => {
              const ok = await confirmAction({
                title: "Supprimer l'attribution",
                message: 'Cette action est définitive et ne peut pas être annulée.',
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
            <input type="hidden" name="id_attribution" value={a.id_attribution} />
            <input type="hidden" name="id_epi" value={a.id_epi} />
            <button
              type="submit"
              class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
              title="Supprimer"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    {/each}
  </div>
</div>

<!-- ── PANNEAU DE DÉTAIL ──────────────────────────────────────────────────── -->
{#if selectedAttr}
  {@const active = !selectedAttr.date_retour}
  <button
    transition:fade={{ duration: 200 }}
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
    onclick={() => (selectedAttrId = null)}
    aria-label="Fermer"
  ></button>

  <div
    in:fly={{ x: 560, duration: 380, easing: quintOut }}
    out:fly={{ x: 560, duration: 250, easing: cubicIn }}
    class="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-120 flex-col overflow-hidden bg-white shadow-2xl"
  >
    <!-- En-tête -->
    <div
      class="relative shrink-0 overflow-hidden bg-linear-to-br from-emerald-900 to-emerald-700 p-6"
    >
      <ArrowRightLeft class="absolute -right-4 -bottom-4 h-32 w-32 text-white/5" />
      <div class="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p class="text-xs tracking-wider text-emerald-300 uppercase">Attribution</p>
          <h2 class="mt-0.5 text-lg font-bold text-white">
            {selectedAttr.designation}
          </h2>
          <p class="mt-1 text-xs text-emerald-200">
            {selectedAttr.chauffeur_nom}
            {selectedAttr.chauffeur_prenom}
          </p>
        </div>
        <button
          onclick={() => (selectedAttrId = null)}
          class="shrink-0 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
      <div class="relative z-10 mt-4">
        {#if active}
          <span
            class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-300"></span>Attribution active
          </span>
        {:else}
          <span
            class="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80"
          >
            <Undo2 class="h-3 w-3" />Retournée le {formatDate(selectedAttr.date_retour)}
          </span>
        {/if}
      </div>
    </div>

    <!-- Corps scrollable -->
    <div class="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
      <!-- Section Chauffeur -->
      <div class="overflow-hidden rounded-xl border-2 border-blue-200 bg-white">
        <div class="flex items-center gap-2 border-b border-blue-100 px-4 py-3">
          <Users class="h-3.5 w-3.5 text-blue-500" />
          <span class="text-[11px] font-semibold tracking-widest text-blue-600 uppercase"
            >Chauffeur</span
          >
        </div>
        <div class="flex items-center gap-3 p-4">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-200 text-sm font-black text-blue-700"
          >
            {initials(selectedAttr.chauffeur_prenom, selectedAttr.chauffeur_nom)}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold text-slate-900">
              {selectedAttr.chauffeur_nom}
              {selectedAttr.chauffeur_prenom}
            </p>
            <p class="truncate text-xs text-slate-400">
              {selectedAttr.chauffeur_activite ?? 'Activité non renseignée'}
            </p>
          </div>
          <button
            onclick={() => voirChauffeur(selectedAttr.id_chauffeur)}
            class="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
          >
            <ExternalLink class="h-3.5 w-3.5" />Fiche
          </button>
        </div>
      </div>

      <!-- Section EPI -->
      <div class="overflow-hidden rounded-xl border-2 border-violet-200 bg-white">
        <div class="flex items-center gap-2 border-b border-violet-100 px-4 py-3">
          <Package class="h-3.5 w-3.5 text-violet-500" />
          <span class="text-[11px] font-semibold tracking-widest text-violet-600 uppercase"
            >EPI</span
          >
        </div>
        <div class="p-4">
          <div class="flex items-center gap-3">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-200 text-violet-600"
            >
              <Package class="h-5 w-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-slate-900">{selectedAttr.designation}</p>
              <p class="truncate text-xs text-slate-400">{selectedAttr.type}</p>
            </div>
            <button
              onclick={() => voirEpi(selectedAttr.id_epi)}
              class="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600"
            >
              <ExternalLink class="h-3.5 w-3.5" />Fiche
            </button>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            {#if selectedAttr.taille}
              <span
                class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
              >
                Taille {selectedAttr.taille}
              </span>
            {/if}
            {#if selectedAttr.epi_statut === 'disponible'}
              <span
                class="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                >Disponible</span
              >
            {:else if selectedAttr.epi_statut === 'attribué'}
              <span
                class="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700"
                >Attribué</span
              >
            {:else if selectedAttr.epi_statut === 'hors_service'}
              <span
                class="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500"
                >Hors service</span
              >
            {/if}
            {#if selectedAttr.epi_date_expiration}
              <span
                class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500"
              >
                <Clock class="h-3 w-3" />Exp. {formatDate(selectedAttr.epi_date_expiration)}
              </span>
            {/if}
          </div>
        </div>
      </div>

      <!-- Section Modification (accordéon) -->
      <div
        class="overflow-hidden rounded-xl border-2 {showEditForm
          ? 'border-emerald-300'
          : 'border-slate-100'} bg-white transition-colors"
      >
        <button
          type="button"
          onclick={() => (showEditForm = !showEditForm)}
          class="flex w-full items-center justify-between gap-2 px-4 py-3 transition-colors
            {showEditForm ? 'border-b border-emerald-100 bg-emerald-50' : 'hover:bg-slate-50'}"
        >
          <div class="flex items-center gap-2">
            <Save class="h-3.5 w-3.5 {showEditForm ? 'text-emerald-500' : 'text-slate-400'}" />
            <span
              class="text-[11px] font-semibold tracking-widest uppercase
              {showEditForm ? 'text-emerald-600' : 'text-slate-400'}">Corriger l'attribution</span
            >
          </div>
          <svg
            class="h-4 w-4 transition-transform {showEditForm
              ? 'rotate-180 text-emerald-500'
              : 'text-slate-300'}"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>

        {#if showEditForm}
          <form
            method="POST"
            action="?/updateAttribution"
            use:enhance={() =>
              ({ update }) =>
                update()}
            class="space-y-3 p-4"
            transition:fly={{ y: -8, duration: 180, easing: quintOut }}
          >
            <input type="hidden" name="id_attribution" value={selectedAttr.id_attribution} />
            <div class="space-y-1.5">
              <label
                for="edit-chauffeur"
                class="text-[10px] font-black tracking-widest text-slate-400 uppercase"
                >Chauffeur</label
              >
              <select
                id="edit-chauffeur"
                name="id_chauffeur"
                bind:value={editChauffeurId}
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-none"
              >
                {#each data.chauffeurs as c (c.id_chauffeur)}
                  <option value={c.id_chauffeur}>{c.nom} {c.prenom}</option>
                {/each}
              </select>
            </div>
            <div class="space-y-1.5">
              <label
                for="edit-epi-search"
                class="text-[10px] font-black tracking-widest text-slate-400 uppercase">EPI</label
              >
              <input type="hidden" name="id_modele_epi" value={editModeleId} />
              <div class="relative">
                <Search
                  class="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="edit-epi-search"
                  type="text"
                  bind:value={editEpiSearch}
                  onfocus={() => (showEditEpiDropdown = true)}
                  oninput={() => {
                    showEditEpiDropdown = true;
                    editModeleId = '';
                  }}
                  onblur={() => setTimeout(() => (showEditEpiDropdown = false), 150)}
                  autocomplete="off"
                  class="w-full rounded-xl border py-2 pr-3 pl-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400/30
                    {editModeleId
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-white'}"
                />
                {#if showEditEpiDropdown}
                  {#if filteredEditEpi.length > 0}
                    <ul
                      class="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                    >
                      {#each filteredEditEpi as e (e.id_modele_epi)}
                        <li>
                          <button
                            type="button"
                            onmousedown={() => {
                              editModeleId = e.id_modele_epi;
                              editEpiSearch = epiLabel(e);
                              showEditEpiDropdown = false;
                            }}
                            disabled={e.stock_dispo <= 0 &&
                              e.id_modele_epi !== selectedAttr?.id_modele_epi}
                            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors
                              {e.stock_dispo <= 0 && e.id_modele_epi !== selectedAttr?.id_modele_epi
                              ? 'cursor-not-allowed opacity-40'
                              : 'hover:bg-emerald-50'}
                              {editModeleId === e.id_modele_epi
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-slate-700'}"
                          >
                            <span class="min-w-0 flex-1 text-xs leading-tight">
                              <span class="font-semibold">{e.designation}</span>
                              {#if e.taille}<span class="text-slate-400"> · {e.taille}</span>{/if}
                              <span class="text-slate-400"> — {e.type}</span>
                            </span>
                            {#if e.stock_dispo <= 0}
                              <span
                                class="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-500"
                                >ÉPUISÉ</span
                              >
                            {:else}
                              <span class="shrink-0 text-[10px] font-semibold text-emerald-600"
                                >{e.stock_dispo} dispo</span
                              >
                            {/if}
                          </button>
                        </li>
                      {/each}
                    </ul>
                  {:else}
                    <div
                      class="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-400 shadow-lg"
                    >
                      Aucun EPI trouvé
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
            <button
              type="submit"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
            >
              <Save class="h-4 w-4" />Enregistrer les modifications
            </button>
          </form>
        {/if}
      </div>
    </div>

    <!-- Pied : actions -->
    <div
      class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4"
    >
      {#if active}
        <form
          method="POST"
          action="?/returnEpi"
          use:enhance={async ({ cancel }) => {
            const ok = await confirmAction({
              title: "Retourner l'EPI",
              message: `Confirmer le retour de « ${selectedAttr?.designation} » ?`,
              confirmLabel: 'Retourner',
              confirmVariant: 'success',
            });
            if (!ok) {
              cancel();
              return;
            }
            return ({ update }) => update();
          }}
        >
          <input type="hidden" name="id_attribution" value={selectedAttr.id_attribution} />
          <input type="hidden" name="id_epi" value={selectedAttr.id_epi} />
          <button
            type="submit"
            class="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <RotateCcw class="h-4 w-4" />Retourner l'EPI
          </button>
        </form>
      {:else}
        <span class="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <CircleCheck class="h-4 w-4 text-emerald-500" />EPI déjà retourné
        </span>
      {/if}

      {#if !confirmDelete}
        <button
          onclick={() => (confirmDelete = true)}
          class="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <Trash2 class="h-4 w-4" />Supprimer
        </button>
      {:else}
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-red-600">Confirmer ?</span>
          <form
            method="POST"
            action="?/deleteAttribution"
            use:enhance={() =>
              ({ update }) => {
                selectedAttrId = null;
                update();
              }}
          >
            <input type="hidden" name="id_attribution" value={selectedAttr.id_attribution} />
            <input type="hidden" name="id_epi" value={selectedAttr.id_epi} />
            <button
              type="submit"
              class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
            >
              Oui
            </button>
          </form>
          <button
            onclick={() => (confirmDelete = false)}
            class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Annuler
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ── PANNEAU DE CRÉATION ────────────────────────────────────────────────── -->
{#if showCreate}
  <button
    transition:fade={{ duration: 200 }}
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
    onclick={() => (showCreate = false)}
    aria-label="Fermer"
  ></button>

  <div
    in:fly={{ x: 560, duration: 380, easing: quintOut }}
    out:fly={{ x: 560, duration: 250, easing: cubicIn }}
    class="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-120 flex-col overflow-hidden bg-white shadow-2xl"
  >
    <div
      class="relative shrink-0 overflow-hidden bg-linear-to-br from-emerald-900 to-emerald-700 p-6"
    >
      <Plus class="absolute -right-4 -bottom-4 h-32 w-32 text-white/5" />
      <div class="relative z-10 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-bold text-white">Nouvelle attribution</h2>
          <p class="mt-0.5 text-xs text-emerald-200">Attribuer un EPI disponible à un chauffeur</p>
        </div>
        <button
          onclick={() => (showCreate = false)}
          class="shrink-0 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
    </div>

    <form
      method="POST"
      action="?/creerAttribution"
      use:enhance={({ cancel }) => {
        if (!createIsValid) {
          cancel();
          return;
        }
        return ({ update }) => {
          showCreate = false;
          update();
        };
      }}
      class="flex flex-1 flex-col overflow-y-auto"
    >
      <div class="flex-1 space-y-5 p-6">
        <div class="space-y-1.5">
          <label
            for="create-chauffeur"
            class="text-[11px] font-black tracking-widest text-slate-400 uppercase"
            >Chauffeur <span class="text-red-400">*</span></label
          >
          <input type="hidden" name="id_chauffeur" value={createChauffeurId} />
          <div class="relative">
            <Search
              class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="create-chauffeur"
              type="text"
              bind:value={createChauffeurSearch}
              onfocus={() => (showChauffeurDropdown = true)}
              oninput={() => {
                showChauffeurDropdown = true;
                createChauffeurId = '';
              }}
              onblur={() => setTimeout(() => (showChauffeurDropdown = false), 150)}
              placeholder="Rechercher un chauffeur…"
              autocomplete="off"
              class="w-full rounded-xl border py-3 pr-4 pl-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400/30
                {createChauffeurId
                ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-500'
                : 'border-slate-200 bg-slate-50 focus:border-emerald-500 focus:bg-white'}"
            />
            {#if showChauffeurDropdown && filteredCreateChauffeurs.length > 0}
              <ul
                class="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
              >
                {#each filteredCreateChauffeurs as c (c.id_chauffeur)}
                  <li>
                    <button
                      type="button"
                      onmousedown={() => selectChauffeur(c.id_chauffeur, c.prenom, c.nom)}
                      class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-emerald-50
                        {c.id_chauffeur === createChauffeurId
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-700'}"
                    >
                      <span
                        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[11px] font-black text-emerald-700"
                      >
                        {initials(c.prenom, c.nom)}
                      </span>
                      {c.nom}
                      {c.prenom}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
            {#if showChauffeurDropdown && filteredCreateChauffeurs.length === 0}
              <div
                class="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 shadow-lg"
              >
                Aucun chauffeur trouvé
              </div>
            {/if}
          </div>
          {#if selectedChauffeurLabel}
            <p class="text-[11px] font-semibold text-emerald-600">✓ Chauffeur sélectionné</p>
          {/if}
        </div>

        <!-- Liste dynamique d'EPI -->
        <div class="space-y-2">
          <p class="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            EPI disponibles <span class="text-red-400">*</span>
          </p>
          {#each createEpiLines as line, i (i)}
            <div class="flex items-center gap-2">
              <input type="hidden" name="id_modele_epi" value={line.id} />
              <div class="relative min-w-0 flex-1">
                <Search
                  class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  bind:value={line.search}
                  onfocus={() => (createEpiLines[i].open = true)}
                  oninput={() => {
                    createEpiLines[i].open = true;
                    createEpiLines[i].id = '';
                  }}
                  onblur={() =>
                    setTimeout(() => {
                      createEpiLines[i].open = false;
                    }, 150)}
                  placeholder="Rechercher un EPI…"
                  autocomplete="off"
                  class="w-full rounded-xl border py-3 pr-4 pl-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400/30
                    {line.id
                    ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-500'
                    : 'border-slate-200 bg-slate-50 focus:border-emerald-500 focus:bg-white'}"
                />
                {#if line.open}
                  {@const results = filteredEpi(i, line.search)}
                  {#if results.length > 0}
                    <ul
                      class="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                    >
                      {#each results as e (e.id_modele_epi)}
                        <li>
                          <button
                            type="button"
                            onmousedown={() => selectEpi(i, e.id_modele_epi, epiLabel(e))}
                            disabled={e.stock_dispo <= 0}
                            class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors
                              {e.stock_dispo <= 0
                              ? 'cursor-not-allowed opacity-40'
                              : 'hover:bg-emerald-50'}
                              {line.id === e.id_modele_epi
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-slate-700'}"
                          >
                            <span class="min-w-0 flex-1 leading-tight">
                              <span class="font-semibold">{e.designation}</span>
                              {#if e.taille}<span class="text-slate-400"> · {e.taille}</span>{/if}
                              <span class="text-slate-400"> — {e.type}</span>
                            </span>
                            {#if e.stock_dispo <= 0}
                              <span
                                class="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-500"
                                >ÉPUISÉ</span
                              >
                            {:else}
                              <span class="shrink-0 text-[11px] font-semibold text-emerald-600"
                                >{e.stock_dispo} dispo</span
                              >
                            {/if}
                          </button>
                        </li>
                      {/each}
                    </ul>
                  {:else}
                    <div
                      class="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 shadow-lg"
                    >
                      Aucun EPI trouvé
                    </div>
                  {/if}
                {/if}
              </div>
              {#if createEpiLines.length > 1}
                <button
                  type="button"
                  onclick={() => removeEpiLine(i)}
                  class="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Supprimer cette ligne"
                >
                  <X class="h-4 w-4" />
                </button>
              {/if}
            </div>
          {/each}

          {#if data.episDisponibles.every((e) => e.stock_dispo <= 0)}
            <p class="text-xs text-amber-600">Aucun EPI disponible actuellement.</p>
          {:else if createEpiLines.filter((l) => l.id).length < data.episDisponibles.filter((e) => e.stock_dispo > 0).length}
            <button
              type="button"
              onclick={addEpiLine}
              class="flex items-center gap-2 rounded-xl border border-dashed border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-600 transition-colors hover:border-emerald-400 hover:bg-emerald-50"
            >
              <Plus class="h-4 w-4" />Ajouter un EPI
            </button>
          {/if}

          {#if createEpiLines.filter((l) => l.id).length > 1}
            <p class="text-[11px] text-slate-400">
              {createEpiLines.filter((l) => l.id).length} attributions distinctes seront créées.
            </p>
          {/if}
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-3 border-t border-slate-100 bg-white px-6 py-4">
        <button
          type="submit"
          disabled={!createIsValid}
          class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus class="h-4 w-4" />
          {createEpiLines.filter((l) => l.id).length > 1
            ? `Créer ${createEpiLines.filter((l) => l.id).length} attributions`
            : "Créer l'attribution"}
        </button>
        <button
          type="button"
          onclick={() => (showCreate = false)}
          class="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50"
        >
          Annuler
        </button>
      </div>
    </form>
  </div>
{/if}
