<script lang="ts">
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import { confirmAction } from '$lib/stores/confirm';
  import {
    Package,
    ShieldCheck,
    ShieldX,
    TriangleAlert,
    Clock,
    Wrench,
    Trash2,
    X,
    Plus,
    Save,
    UserCheck,
    UserX,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    CircleCheck,
    CircleX,
    RotateCcw,
    Search,
  } from 'lucide-svelte';
  import { fly, fade } from 'svelte/transition';
  import { quintOut, cubicIn } from 'svelte/easing';

  let { data }: { data: PageData } = $props();

  type Epi = (typeof data.epis)[0];

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';

  const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

  type AlertLevel = 'expired' | 'expiring_soon' | 'control_overdue' | 'control_soon' | 'ok';

  function getAlertLevel(epi: Epi): AlertLevel {
    const days = epi.date_expiration ? daysUntil(epi.date_expiration) : null;
    const latest = epi.controles[0];
    const controlDays = latest?.prochain_controle ? daysUntil(latest.prochain_controle) : null;
    if (days !== null && days < 0) return 'expired';
    if (controlDays !== null && controlDays < 0) return 'control_overdue';
    if (days !== null && days <= 30) return 'expiring_soon';
    if (controlDays !== null && controlDays <= 30) return 'control_soon';
    return 'ok';
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  const stats = $derived({
    total: data.epis.length,
    disponibles: data.epis.filter((e) => e.statut === 'disponible').length,
    attribues: data.epis.filter((e) => e.statut === 'attribué').length,
    horsService: data.epis.filter((e) => e.statut === 'hors_service').length,
  });

  const allTypes = $derived(
    [...new Set(data.epis.map((e) => e.type).filter(Boolean))].sort() as string[],
  );

  // ── Filtres & tri ────────────────────────────────────────────────────
  let search = $state('');
  let filterStatut = $state('');
  let filterType = $state('');
  let showSearchDropdown = $state(false);

  const allChauffeurNames = $derived(
    [...new Set(data.epis.flatMap((e) => e.historique.map((h) => h.chauffeur_nom)))].sort(),
  );

  const searchSuggestions = $derived.by(() => {
    const q = search.toLowerCase().trim();
    const chauffeurs = q
      ? allChauffeurNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 5)
      : allChauffeurNames.slice(0, 6);
    const epiNames = q
      ? [...new Set(data.epis.map((e) => e.designation))]
          .filter((d) => d.toLowerCase().includes(q))
          .sort()
          .slice(0, 4)
      : [];
    return { chauffeurs, epiNames };
  });

  type SortCol = 'designation' | 'type' | 'statut' | 'chauffeur' | 'expiration';
  let sortCol = $state<SortCol>('designation');
  let sortDir = $state<'asc' | 'desc'>('asc');

  function toggleSort(col: SortCol) {
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else {
      sortCol = col;
      sortDir = 'asc';
    }
  }

  const ALERT_RANK: Record<AlertLevel, number> = {
    expired: 0,
    control_overdue: 1,
    expiring_soon: 2,
    control_soon: 3,
    ok: 4,
  };
  const STATUT_RANK: Record<string, number> = { disponible: 0, attribué: 1, hors_service: 2 };

  const filtered = $derived.by(() => {
    const rows = data.epis.filter((e) => {
      const q = search.toLowerCase();
      if (q) {
        const matchesEpi =
          e.designation.toLowerCase().includes(q) || e.type.toLowerCase().includes(q);
        const matchesChauffeur = e.historique.some((h) =>
          h.chauffeur_nom.toLowerCase().includes(q),
        );
        if (!matchesEpi && !matchesChauffeur) return false;
      }
      if (filterStatut && e.statut !== filterStatut) return false;
      if (filterType && e.type !== filterType) return false;
      return true;
    });

    rows.sort((a, b) => {
      let cmp = 0;
      const attrA = a.historique.find((h) => !h.date_retour);
      const attrB = b.historique.find((h) => !h.date_retour);
      if (sortCol === 'designation') cmp = a.designation.localeCompare(b.designation, 'fr');
      else if (sortCol === 'type') cmp = a.type.localeCompare(b.type, 'fr');
      else if (sortCol === 'statut')
        cmp = (STATUT_RANK[a.statut] ?? 3) - (STATUT_RANK[b.statut] ?? 3);
      else if (sortCol === 'chauffeur')
        cmp = (attrA?.chauffeur_nom ?? '').localeCompare(attrB?.chauffeur_nom ?? '', 'fr');
      else if (sortCol === 'expiration')
        cmp = ALERT_RANK[getAlertLevel(a)] - ALERT_RANK[getAlertLevel(b)];
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  });

  // ── Panel de détail ────────────────────────────────────────────────
  let selectedEpiId = $state<string | null>(null);
  const selectedEpi = $derived(
    selectedEpiId ? (data.epis.find((e) => e.id_epi === selectedEpiId) ?? null) : null,
  );
  const activeAttr = $derived(selectedEpi?.historique.find((h) => !h.date_retour) ?? null);
  const latestCtrl = $derived(selectedEpi?.controles[0] ?? null);
  const ctrlDays = $derived(
    latestCtrl?.prochain_controle ? daysUntil(latestCtrl.prochain_controle) : null,
  );

  function openEpi(id: string) {
    selectedEpiId = id;
    confirmDelete = false;
    showAttribuerForm = false;
    showControleForm = false;
    attribuerChauffeurId = '';
  }

  // Ouvre automatiquement la fiche d'un EPI si l'URL contient ?fiche=<id>
  // (utilisé par le bouton « Voir la fiche » de la page Attributions).
  let handledFiche = $state<string | null>(null);
  $effect(() => {
    const fiche = $page.url.searchParams.get('fiche');
    if (fiche && fiche !== handledFiche && data.epis.some((e) => e.id_epi === fiche)) {
      handledFiche = fiche;
      openEpi(fiche);
    }
  });

  let confirmDelete = $state(false);
  let showAttribuerForm = $state(false);
  let showControleForm = $state(false);
  let attribuerChauffeurId = $state('');
  let controleResultat = $state('');

  // ── Panel création modèle ───────────────────────────────────────────
  let showCreatePanel = $state(false);
  let createDesignation = $state('');
  let createType = $state('');
  let createTaille = $state('');
  let createStockTotal = $state(0);
  let createSeuilAlerte = $state(0);

  function openCreatePanel() {
    showCreatePanel = true;
    createDesignation = '';
    createType = '';
    createTaille = '';
    createStockTotal = 0;
    createSeuilAlerte = 0;
  }
</script>

<!-- ── PAGE ──────────────────────────────────────────────────────────────── -->
<div
  class="w-full max-w-7xl mx-auto p-4 lg:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700"
>
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4">
      <div class="p-3 rounded-2xl bg-violet-700 shadow-lg">
        <Package class="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 class="text-3xl font-black text-violet-900 tracking-tight uppercase">EPI</h1>
      </div>
    </div>
    <button
      onclick={openCreatePanel}
      class="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-violet-700 text-white text-sm font-bold hover:bg-violet-600 transition-colors shadow-lg"
    >
      <Plus class="w-4 h-4" />
      Ajouter un EPI
    </button>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 border-violet-700 flex items-center gap-4"
      style="background: linear-gradient(90deg, #5b21b6 0%, #6d28d9 100%)"
    >
      <Package class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0"
        >{stats.total}</span
      >
      <p class="text-violet-200 text-sm font-bold leading-snug">EPI au total</p>
    </div>

    <button
      onclick={() => (filterStatut = filterStatut === 'disponible' ? '' : 'disponible')}
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 text-left transition-all flex items-center gap-4
        {filterStatut === 'disponible'
        ? 'border-violet-600 ring-2 ring-violet-400'
        : 'border-violet-500'}"
      style="background: linear-gradient(90deg, #7c3aed 0%, #8b5cf6 100%)"
    >
      <ShieldCheck class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0"
        >{stats.disponibles}</span
      >
      <p class="text-violet-100 text-sm font-bold leading-snug">Disponibles</p>
    </button>

    <button
      onclick={() => (filterStatut = filterStatut === 'attribué' ? '' : 'attribué')}
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 text-left transition-all flex items-center gap-4
        {filterStatut === 'attribué'
        ? 'border-violet-400 ring-2 ring-violet-300'
        : 'border-violet-300'}"
      style="background: linear-gradient(90deg, #a78bfa 0%, #c4b5fd 100%)"
    >
      <UserCheck class="absolute -right-3 -bottom-3 w-20 h-20 text-violet-600/20" />
      <span class="text-4xl font-black text-violet-900 tabular-nums leading-none shrink-0"
        >{stats.attribues}</span
      >
      <p class="text-violet-800 text-sm font-bold leading-snug">Attribués</p>
    </button>

    <button
      onclick={() => (filterStatut = filterStatut === 'hors_service' ? '' : 'hors_service')}
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 text-left transition-all flex items-center gap-4
        {filterStatut === 'hors_service'
        ? 'border-violet-300 ring-2 ring-violet-200'
        : 'border-violet-200'}"
      style="background: linear-gradient(90deg, #ddd6fe 0%, #ede9fe 100%)"
    >
      <ShieldX class="absolute -right-3 -bottom-3 w-20 h-20 text-violet-300/40" />
      <span class="text-4xl font-black text-violet-900 tabular-nums leading-none shrink-0"
        >{stats.horsService}</span
      >
      <p class="text-violet-600 text-sm font-bold leading-snug">Hors service</p>
    </button>
  </div>

  <!-- Barre de filtres -->
  <div class="flex flex-col sm:flex-row gap-3">
    <div class="relative flex-1">
      <Search
        class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        bind:value={search}
        onfocus={() => (showSearchDropdown = true)}
        onblur={() => setTimeout(() => (showSearchDropdown = false), 150)}
        placeholder="Rechercher par EPI ou chauffeur…"
        class="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm font-medium shadow-sm focus:border-transparent focus:ring-2 focus:ring-violet-400 focus:outline-none"
      />
      {#if showSearchDropdown && (searchSuggestions.chauffeurs.length > 0 || searchSuggestions.epiNames.length > 0)}
        <div
          class="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {#if searchSuggestions.chauffeurs.length > 0}
            <div
              class="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold tracking-widest text-slate-400 uppercase"
            >
              Chauffeurs
            </div>
            {#each searchSuggestions.chauffeurs as name (name)}
              <button
                type="button"
                onmousedown={() => {
                  search = name;
                  showSearchDropdown = false;
                }}
                class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-violet-50
                  {search === name ? 'bg-violet-50 text-violet-700' : ''}"
              >
                <span
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[11px] font-black text-violet-700"
                >
                  {name[0]?.toUpperCase()}
                </span>
                {name}
              </button>
            {/each}
          {/if}
          {#if searchSuggestions.epiNames.length > 0}
            <div
              class="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold tracking-widest text-slate-400 uppercase
                {searchSuggestions.chauffeurs.length > 0 ? 'border-t border-slate-100' : ''}"
            >
              EPI
            </div>
            {#each searchSuggestions.epiNames as name (name)}
              <button
                type="button"
                onmousedown={() => {
                  search = name;
                  showSearchDropdown = false;
                }}
                class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-violet-50
                  {search === name ? 'bg-violet-50 text-violet-700' : ''}"
              >
                <span
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[11px] font-black text-violet-700"
                >
                  <Package class="h-3.5 w-3.5" />
                </span>
                {name}
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
    <select
      bind:value={filterType}
      class="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-40"
    >
      <option value="">Tous les types</option>
      {#each allTypes as t (t)}
        <option value={t}>{t}</option>
      {/each}
    </select>
    {#if filterStatut || filterType}
      <button
        onclick={() => {
          filterStatut = '';
          filterType = '';
        }}
        class="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-100 text-violet-700 text-sm font-bold hover:bg-violet-200 transition-colors"
      >
        <X class="w-3.5 h-3.5" />Effacer les filtres
      </button>
    {/if}
  </div>

  <!-- Tableau -->
  <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
    <!-- En-têtes -->
    <div
      class="grid items-center gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50"
      style="grid-template-columns: 1fr 70px 130px 1fr 140px 56px"
    >
      {#snippet sortBtn(col: SortCol, label: string, center = false)}
        <button
          onclick={() => toggleSort(col)}
          class="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest transition-colors
            {sortCol === col ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'}
            {center ? 'justify-center' : ''}"
        >
          {label}
          {#if sortCol === col}
            {#if sortDir === 'asc'}
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
      {@render sortBtn('type', 'Taille', true)}
      {@render sortBtn('statut', 'Statut', true)}
      {@render sortBtn('chauffeur', 'Chauffeur')}
      {@render sortBtn('expiration', 'Alertes', true)}
      <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 text-center">
        Suppr.
      </p>
    </div>

    {#if filtered.length === 0}
      <div class="flex flex-col items-center justify-center gap-3 py-16 opacity-30">
        <Package class="w-12 h-12 text-slate-400" />
        <p class="text-xs font-bold uppercase tracking-widest">Aucun EPI trouvé</p>
      </div>
    {/if}

    {#each filtered as epi (epi.id_epi)}
      {@const alert = getAlertLevel(epi)}
      {@const activeA = epi.historique.find((h) => !h.date_retour)}
      <div
        role="row"
        tabindex="0"
        onclick={() => openEpi(epi.id_epi)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && openEpi(epi.id_epi)}
        class="cursor-pointer grid items-center gap-4 px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group"
        style="grid-template-columns: 1fr 70px 130px 1fr 140px 56px"
      >
        <!-- Désignation -->
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-violet-700 flex items-center justify-center shrink-0">
            <Package class="w-4 h-4 text-white" />
          </div>
          <div class="min-w-0">
            <p class="font-semibold text-sm text-slate-900 truncate">{epi.designation}</p>
            <p class="text-xs text-slate-400 truncate">{epi.type}</p>
          </div>
        </div>

        <!-- Taille -->
        <div class="flex justify-center">
          {#if epi.taille}
            <span
              class="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600"
            >
              {epi.taille}
            </span>
          {:else}
            <span class="text-xs text-slate-300">—</span>
          {/if}
        </div>

        <!-- Statut -->
        <div class="flex justify-center">
          {#if epi.statut === 'disponible'}
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Disponible
            </span>
          {:else if epi.statut === 'attribué'}
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-200 text-xs font-semibold text-violet-700"
            >
              <UserCheck class="w-3 h-3" />Attribué
            </span>
          {:else}
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-500"
            >
              <ShieldX class="w-3 h-3" />Hors service
            </span>
          {/if}
        </div>

        <!-- Chauffeur -->
        <div class="min-w-0">
          {#if activeA}
            <p class="text-sm font-semibold text-slate-700 truncate">{activeA.chauffeur_nom}</p>
            <p class="text-xs text-slate-400">depuis le {formatDate(activeA.date_attribution)}</p>
          {:else}
            <span class="text-xs text-slate-300">—</span>
          {/if}
        </div>

        <!-- Alertes -->
        <div class="flex items-center justify-center gap-1.5">
          {#if alert === 'expired' || alert === 'control_overdue'}
            <span
              class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 border border-red-200 text-[11px] font-semibold text-red-600"
            >
              <TriangleAlert class="w-3 h-3" />Urgent
            </span>
          {:else if alert === 'expiring_soon' || alert === 'control_soon'}
            <span
              class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-600"
            >
              <Clock class="w-3 h-3" />Bientôt
            </span>
          {:else}
            <span class="text-xs text-slate-300">—</span>
          {/if}
        </div>

        <!-- Supprimer -->
        <div
          role="none"
          onclick={(e) => e.stopPropagation()}
          class="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <form
            method="POST"
            action="?/supprimer_epi"
            use:enhance={async ({ cancel }) => {
              const ok = await confirmAction({
                title: "Supprimer l'EPI",
                message: `Supprimer "${epi.designation}" ? Cette action est irréversible.`,
                confirmLabel: 'Supprimer',
                confirmVariant: 'danger',
              });
              if (!ok) { cancel(); return; }
              return ({ update }) => update();
            }}
          >
            <input type="hidden" name="id_epi" value={epi.id_epi} />
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
  </div>
</div>

<!-- ── PANEL DE DÉTAIL ────────────────────────────────────────────────────── -->
{#if selectedEpi}
  <button
    transition:fade={{ duration: 200 }}
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
    onclick={() => (selectedEpiId = null)}
    aria-label="Fermer"
  ></button>

  <div
    in:fly={{ x: 560, duration: 380, easing: quintOut }}
    out:fly={{ x: 560, duration: 250, easing: cubicIn }}
    class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-120 bg-white shadow-2xl flex flex-col overflow-hidden"
  >
    <!-- En-tête -->
    <div
      class="p-6 bg-linear-to-br from-violet-900 to-violet-700 relative overflow-hidden shrink-0"
    >
      <Package class="absolute -right-4 -bottom-4 w-32 h-32 text-white/5" />
      <div class="relative z-10 flex items-start justify-between gap-4 mb-5">
        <div class="flex items-center gap-3.5">
          <div
            class="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0"
          >
            <Package class="w-5 h-5 text-white" />
          </div>
          <div class="min-w-0">
            <h2 class="text-lg font-bold text-white leading-tight truncate">
              {selectedEpi.designation}
            </h2>
            <p class="text-violet-300 text-xs mt-0.5 uppercase tracking-wider">
              {selectedEpi.type}{selectedEpi.taille ? ` · ${selectedEpi.taille}` : ''}
            </p>
          </div>
        </div>
        <button
          onclick={() => (selectedEpiId = null)}
          class="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
        >
          <X class="w-4.5 h-4.5" />
        </button>
      </div>

      <!-- Badges statut + alertes -->
      <div class="relative z-10 flex items-center gap-2 flex-wrap">
        {#if selectedEpi.statut === 'disponible'}
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>Disponible
          </span>
        {:else if selectedEpi.statut === 'attribué'}
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold"
          >
            <UserCheck class="w-3 h-3 shrink-0" />Attribué
          </span>
        {:else}
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-600 text-[11px] font-semibold"
          >
            <ShieldX class="w-3 h-3 shrink-0" />Hors service
          </span>
        {/if}

        {#if selectedEpi.date_expiration}
          {@const expAlert = getAlertLevel(selectedEpi)}
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold
              {expAlert === 'expired'
              ? 'bg-red-50 border border-red-200 text-red-600'
              : expAlert === 'expiring_soon'
                ? 'bg-amber-50 border border-amber-200 text-amber-700'
                : 'bg-slate-100 border border-slate-200 text-slate-500'}"
          >
            <Clock class="w-3 h-3 shrink-0" />{expAlert === 'expired' ? 'Expiré le' : 'Expire le'}
            {formatDate(selectedEpi.date_expiration)}
          </span>
        {/if}

        {#if ctrlDays !== null && ctrlDays < 0}
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold"
          >
            <Wrench class="w-3 h-3 shrink-0" />Ctrl. dépassé
          </span>
        {:else if ctrlDays !== null && ctrlDays <= 30}
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 text-[11px] font-semibold"
          >
            <Wrench class="w-3 h-3 shrink-0" />Ctrl. J-{ctrlDays}
          </span>
        {/if}
      </div>
    </div>

    <!-- Corps scrollable -->
    <div class="flex-1 overflow-y-auto bg-slate-50/60">
      <div class="p-4 space-y-3">
        <!-- ── Carte Attribution ─────────────────────────────────── -->
        <div class="bg-white rounded-xl border-2 border-blue-200 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <UserCheck class="w-3.5 h-3.5 text-blue-500" />
              <span class="text-[11px] font-semibold text-blue-600 uppercase tracking-widest"
                >Chauffeur</span
              >
            </div>
            {#if selectedEpi.statut === 'attribué' && activeAttr}
              <form
                method="POST"
                action="?/retirer_epi"
                use:enhance={async ({ cancel }) => {
                  const ok = await confirmAction({
                    title: "Retirer l'EPI",
                    message: `Retirer "${selectedEpi?.designation}" du chauffeur ?`,
                    confirmLabel: 'Retirer',
                    confirmVariant: 'danger',
                  });
                  if (!ok) { cancel(); return; }
                  return ({ update }) => update();
                }}
              >
                <input type="hidden" name="id_attribution" value={activeAttr.id_attribution} />
                <input type="hidden" name="id_epi" value={selectedEpi.id_epi} />
                <button
                  type="submit"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 text-xs font-medium transition-colors"
                >
                  <UserX class="w-3 h-3" />Retirer
                </button>
              </form>
            {/if}
          </div>

          <div class="p-4">
            {#if activeAttr}
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-xl bg-blue-100 border-2 border-blue-300 flex items-center justify-center font-bold text-blue-600 text-sm shrink-0"
                >
                  {activeAttr.chauffeur_nom[0]?.toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-sm text-slate-900">{activeAttr.chauffeur_nom}</p>
                  <p class="text-xs text-slate-400 mt-0.5">
                    depuis le {formatDate(activeAttr.date_attribution)}
                  </p>
                </div>
                <span
                  class="flex items-center gap-1.5 text-xs font-medium text-emerald-600 shrink-0"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Actif
                </span>
              </div>
            {:else if selectedEpi.statut === 'disponible'}
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs text-slate-400">Aucun chauffeur assigné.</p>
                  <button
                    type="button"
                    onclick={() => (showAttribuerForm = !showAttribuerForm)}
                    class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-300 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors"
                  >
                    <UserCheck class="w-3.5 h-3.5" />Attribuer
                  </button>
                </div>
                {#if showAttribuerForm}
                  <form
                    method="POST"
                    action="?/attribuer_epi"
                    use:enhance={({ cancel }) => {
                      if (!attribuerChauffeurId) {
                        cancel();
                        return;
                      }
                      return ({ update }) => {
                        showAttribuerForm = false;
                        attribuerChauffeurId = '';
                        update();
                      };
                    }}
                    class="flex gap-2"
                    in:fly={{ y: -8, duration: 180 }}
                  >
                    <input type="hidden" name="id_epi" value={selectedEpi.id_epi} />
                    <select
                      name="id_chauffeur"
                      bind:value={attribuerChauffeurId}
                      class="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                    >
                      <option value="">Choisir un chauffeur…</option>
                      {#each data.chauffeurs as c (c.id_chauffeur)}
                        <option value={c.id_chauffeur}>{c.nom} {c.prenom}</option>
                      {/each}
                    </select>
                    <button
                      type="submit"
                      disabled={!attribuerChauffeurId}
                      class="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 transition-colors disabled:opacity-40"
                      >OK</button
                    >
                  </form>
                {/if}
              </div>
            {:else}
              <div class="flex items-center gap-2 py-1 text-slate-400">
                <ShieldX class="w-4 h-4 shrink-0" />
                <p class="text-xs">Équipement hors service — non attribuable</p>
              </div>
            {/if}
          </div>

          <!-- Historique attribution -->
          {#if selectedEpi.historique.filter((h) => h.date_retour).length > 0}
            <div class="border-t border-slate-100 px-4 py-3 space-y-2 bg-slate-50/50">
              <p class="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Historique ({selectedEpi.historique.filter((h) => h.date_retour).length})
              </p>
              {#each selectedEpi.historique.filter((h) => h.date_retour) as attr (attr.id_attribution)}
                <div class="flex items-center gap-2 text-xs">
                  <span class="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                  <span class="font-medium text-slate-600 truncate">{attr.chauffeur_nom}</span>
                  <span class="ml-auto shrink-0 tabular-nums text-slate-400">
                    {formatDate(attr.date_attribution)} → {formatDate(attr.date_retour)}
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- ── Carte Contrôles ────────────────────────────────────── -->
        <div class="bg-white rounded-xl border-2 border-orange-200 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <Wrench class="w-3.5 h-3.5 text-orange-500" />
              <span class="text-[11px] font-semibold text-orange-600 uppercase tracking-widest">
                Contrôles{#if selectedEpi.controles.length > 0}
                  ({selectedEpi.controles.length}){/if}
              </span>
            </div>
            <button
              type="button"
              onclick={() => (showControleForm = !showControleForm)}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-300 text-orange-600 text-xs font-semibold hover:bg-orange-100 transition-colors"
            >
              <CircleCheck class="w-3 h-3" />Nouveau contrôle
            </button>
          </div>

          <div class="p-4 space-y-3">
            {#if showControleForm}
              <form
                method="POST"
                action="?/ajouter_controle"
                use:enhance={({ cancel }) => {
                  if (!controleResultat) {
                    cancel();
                    return;
                  }
                  return ({ update }) => {
                    showControleForm = false;
                    controleResultat = '';
                    update();
                  };
                }}
                class="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3"
                in:fly={{ y: -8, duration: 180 }}
              >
                <input type="hidden" name="id_epi" value={selectedEpi.id_epi} />
                <input type="hidden" name="resultat" value={controleResultat} />
                <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Résultat du contrôle
                </p>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onclick={() => (controleResultat = 'conforme')}
                    class="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border-2 text-xs font-semibold transition-all
                      {controleResultat === 'conforme'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-600'}"
                  >
                    <CircleCheck class="w-3.5 h-3.5" />Conforme
                  </button>
                  <button
                    type="button"
                    onclick={() => (controleResultat = 'à_remplacer')}
                    class="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border-2 text-xs font-semibold transition-all
                      {controleResultat === 'à_remplacer'
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:text-red-600'}"
                  >
                    <CircleX class="w-3.5 h-3.5" />À remplacer
                  </button>
                </div>
                <p class="text-xs text-slate-400">Aujourd'hui · Prochain contrôle dans 1 an</p>
                <div class="flex gap-2">
                  <button
                    type="submit"
                    disabled={!controleResultat}
                    class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 transition-colors disabled:opacity-40"
                  >
                    <Save class="w-3.5 h-3.5" />Enregistrer
                  </button>
                  <button
                    type="button"
                    onclick={() => {
                      showControleForm = false;
                      controleResultat = '';
                    }}
                    class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            {/if}

            <!-- Prochain contrôle -->
            {#if latestCtrl?.prochain_controle}
              <div
                class="flex items-center gap-3 rounded-lg px-3.5 py-3 border
                  {ctrlDays !== null && ctrlDays < 0
                  ? 'bg-red-50 border-red-100'
                  : ctrlDays !== null && ctrlDays <= 30
                    ? 'bg-amber-50 border-amber-100'
                    : 'bg-emerald-50 border-emerald-100'}"
              >
                <div class="flex-1 min-w-0">
                  <p
                    class="text-[10px] font-semibold uppercase tracking-widest
                      {ctrlDays !== null && ctrlDays < 0
                      ? 'text-red-500'
                      : ctrlDays !== null && ctrlDays <= 30
                        ? 'text-amber-600'
                        : 'text-emerald-600'}"
                  >
                    {ctrlDays !== null && ctrlDays < 0 ? 'Contrôle dépassé' : 'Prochain contrôle'}
                  </p>
                  <p class="text-sm font-semibold text-slate-800 mt-0.5">
                    {formatDate(latestCtrl.prochain_controle)}
                  </p>
                </div>
                <span
                  class="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0
                    {ctrlDays !== null && ctrlDays < 0
                    ? 'bg-red-100 text-red-700'
                    : ctrlDays !== null && ctrlDays <= 30
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'}"
                >
                  {#if ctrlDays !== null && ctrlDays < 0}
                    {Math.abs(ctrlDays)}j de retard
                  {:else if ctrlDays !== null}
                    J-{ctrlDays}
                  {:else}
                    —
                  {/if}
                </span>
              </div>
            {:else if selectedEpi.controles.length === 0}
              <div class="flex items-center gap-2 py-2 text-slate-400">
                <Wrench class="w-4 h-4 shrink-0" />
                <p class="text-xs">Aucun contrôle enregistré</p>
              </div>
            {/if}

            <!-- Historique contrôles -->
            {#if selectedEpi.controles.length > 0}
              <div class="space-y-0.5">
                <p
                  class="text-[10px] font-semibold uppercase tracking-widest text-slate-400 pt-1 pb-1"
                >
                  Historique
                </p>
                {#each selectedEpi.controles as ctrl (ctrl.id_controle)}
                  {@const isConforme = ctrl.resultat === 'conforme'}
                  <div
                    class="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0"
                  >
                    {#if isConforme}
                      <CircleCheck class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {:else}
                      <CircleX class="w-3.5 h-3.5 text-red-400 shrink-0" />
                    {/if}
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-xs font-semibold {isConforme
                          ? 'text-emerald-700'
                          : 'text-red-600'}"
                      >
                        {isConforme ? 'Conforme' : 'À remplacer'}
                      </p>
                      {#if ctrl.date_controle}
                        <p class="text-[10px] text-slate-400">
                          Effectué le {formatDate(ctrl.date_controle)}
                        </p>
                      {/if}
                    </div>
                    {#if ctrl.prochain_controle}
                      <span class="text-[10px] text-slate-400 tabular-nums shrink-0">
                        → {formatDate(ctrl.prochain_controle)}
                      </span>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Pied du panel -->
    <div
      class="shrink-0 px-5 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 flex-wrap"
    >
      <div>
        {#if selectedEpi.statut !== 'hors_service'}
          <form
            method="POST"
            action="?/hors_service"
            use:enhance={async ({ cancel }) => {
              const ok = await confirmAction({
                title: 'Mettre hors service',
                message: `Marquer "${selectedEpi?.designation}" comme hors service ?`,
                confirmLabel: 'Confirmer',
                confirmVariant: 'danger',
              });
              if (!ok) { cancel(); return; }
              return ({ update }) => update();
            }}
          >
            <input type="hidden" name="id_epi" value={selectedEpi.id_epi} />
            {#if activeAttr}
              <input type="hidden" name="id_attribution" value={activeAttr.id_attribution} />
            {/if}
            <button
              type="submit"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 text-amber-700 bg-white text-sm font-medium hover:bg-amber-50 transition-colors"
            >
              <ShieldX class="w-4 h-4" />Hors service
            </button>
          </form>
        {:else}
          <form
            method="POST"
            action="?/remettre_en_service"
            use:enhance={() =>
              ({ update }) =>
                update()}
          >
            <input type="hidden" name="id_epi" value={selectedEpi.id_epi} />
            <button
              type="submit"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 bg-white text-sm font-medium hover:bg-emerald-50 transition-colors"
            >
              <RotateCcw class="w-4 h-4" />Remettre en service
            </button>
          </form>
        {/if}
      </div>

      {#if !confirmDelete}
        <button
          onclick={() => (confirmDelete = true)}
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 bg-white text-sm font-medium hover:bg-red-50 transition-colors"
        >
          <Trash2 class="w-4 h-4" />Supprimer
        </button>
      {:else}
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-red-600">Confirmer la suppression ?</span>
          <form
            method="POST"
            action="?/supprimer_epi"
            use:enhance={() =>
              ({ update }) => {
                selectedEpiId = null;
                update();
              }}
          >
            <input type="hidden" name="id_epi" value={selectedEpi.id_epi} />
            <button
              type="submit"
              class="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
            >
              Oui
            </button>
          </form>
          <button
            onclick={() => (confirmDelete = false)}
            class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ── PANEL CRÉATION ──────────────────────────────────────────────────────── -->
{#if showCreatePanel}
  <button
    transition:fade={{ duration: 200 }}
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
    onclick={() => (showCreatePanel = false)}
    aria-label="Fermer"
  ></button>

  <div
    in:fly={{ x: 560, duration: 380, easing: quintOut }}
    out:fly={{ x: 560, duration: 250, easing: cubicIn }}
    class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-120 bg-white shadow-2xl flex flex-col overflow-hidden"
  >
    <!-- En-tête -->
    <div
      class="p-6 bg-linear-to-br from-violet-900 to-violet-700 relative overflow-hidden shrink-0"
    >
      <Plus class="absolute -right-4 -bottom-4 w-32 h-32 text-white/5" />
      <div class="relative z-10 flex items-start justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div
            class="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center"
          >
            <Package class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-lg font-bold text-white">Nouvel EPI</h2>
            <p class="text-violet-300 text-xs mt-0.5">Définir un nouvel équipement</p>
          </div>
        </div>
        <button
          onclick={() => (showCreatePanel = false)}
          class="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
        >
          <X class="w-4.5 h-4.5" />
        </button>
      </div>
    </div>

    <!-- Corps -->
    <form
      method="POST"
      action="?/creer_modele"
      use:enhance={({ cancel }) => {
        if (!createDesignation || !createType) {
          cancel();
          return;
        }
        return ({ update }) => {
          showCreatePanel = false;
          update();
        };
      }}
      class="flex-1 overflow-y-auto flex flex-col"
    >
      <div class="flex-1 p-6 space-y-5">
        <!-- Désignation -->
        <div class="space-y-1.5">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Désignation <span class="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="designation"
            bind:value={createDesignation}
            placeholder="ex : Casque de chantier"
            class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm
              focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-500 focus:bg-white transition-all"
          />
        </div>

        <!-- Type -->
        <div class="space-y-1.5">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Type <span class="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="type"
            bind:value={createType}
            placeholder="ex : Protection tête"
            list="types-existants"
            class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm
              focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-500 focus:bg-white transition-all"
          />
          <datalist id="types-existants">
            {#each allTypes as t (t)}
              <option value={t}></option>
            {/each}
          </datalist>
        </div>

        <!-- Taille -->
        <div class="space-y-1.5">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Taille <span class="text-slate-300 font-normal normal-case tracking-normal"
              >(optionnel)</span
            >
          </label>
          <input
            type="text"
            name="taille"
            bind:value={createTaille}
            placeholder="ex : M, L, XL, 42…"
            class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm
              focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-500 focus:bg-white transition-all"
          />
        </div>

        <!-- Stock total + Seuil alerte -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Stock total
            </label>
            <input
              type="number"
              name="stock_total"
              bind:value={createStockTotal}
              min="0"
              class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm
                focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-500 focus:bg-white transition-all"
            />
          </div>
          <div class="space-y-1.5">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Seuil d'alerte
            </label>
            <input
              type="number"
              name="seuil_alerte"
              bind:value={createSeuilAlerte}
              min="0"
              class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm
                focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      <!-- Pied -->
      <div class="shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex items-center gap-3">
        <button
          type="submit"
          disabled={!createDesignation || !createType}
          class="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-violet-700 text-white text-sm font-bold hover:bg-violet-600 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus class="w-4 h-4" />Créer l'EPI
        </button>
        <button
          type="button"
          onclick={() => (showCreatePanel = false)}
          class="px-5 py-3 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  </div>
{/if}
