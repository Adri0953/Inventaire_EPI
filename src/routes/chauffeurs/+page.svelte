<script lang="ts">
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import {
    Users,
    ShieldCheck,
    ShieldAlert,
    ShieldX,
    TriangleAlert,
    Pencil,
    Trash2,
    ArrowRightLeft,
    X,
    Plus,
    Package,
    Save,
    Clock,
    Wrench,
    UserPlus,
    ChevronsUpDown,
    ChevronUp,
    ChevronDown,
    Ellipsis,
  } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { confirmAction } from '$lib/stores/confirm';
  import { fly, fade } from 'svelte/transition';
  import { quintOut, cubicIn } from 'svelte/easing';

  let { data }: { data: PageData } = $props();

  const ACTIVITES = [
    'Livraison longue distance',
    'Transport urbain',
    'Manutention',
    'Conduite de chariots',
    'Logistique entrepôt',
  ];

  const PRESETS: Record<string, string[]> = {
    'Livraison longue distance': ['chaussures', 'gilet', 'gants'],
    'Transport urbain': ['chaussures', 'gilet'],
    Manutention: ['chaussures', 'gants', 'casque', 'gilet'],
    'Conduite de chariots': ['chaussures', 'casque', 'gilet', 'gants'],
    'Logistique entrepôt': ['chaussures', 'gilet', 'gants'],
  };

  type Chauffeur = (typeof data.chauffeurs)[0];

  function epiMatchesKeyword(epi: Chauffeur['epis'][0], keyword: string) {
    return `${epi.type ?? ''} ${epi.designation}`.toLowerCase().includes(keyword);
  }

  function getEquipmentStatus(c: Chauffeur): 'complet' | 'incomplet' | 'non_equipe' {
    if (c.epis.length === 0) return 'non_equipe';
    if (!c.activite || !PRESETS[c.activite]) return 'complet';
    const keywords = PRESETS[c.activite];
    const allPresent = keywords.every((kw) => c.epis.some((e) => epiMatchesKeyword(e, kw)));
    return allPresent ? 'complet' : 'incomplet';
  }

  function getMissingEpis(c: Chauffeur): string[] {
    if (!c.activite || !PRESETS[c.activite]) return [];
    return PRESETS[c.activite].filter((kw) => !c.epis.some((e) => epiMatchesKeyword(e, kw)));
  }

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';

  const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

  function getAlertLevel(c: Chauffeur): 'red' | 'orange' | null {
    for (const epi of c.epis) {
      if (epi.date_expiration && daysUntil(epi.date_expiration) < 0) return 'red';
      if (epi.prochain_controle && daysUntil(epi.prochain_controle) < 0) return 'red';
    }
    for (const epi of c.epis) {
      if (epi.date_expiration) {
        const d = daysUntil(epi.date_expiration);
        if (d >= 0 && d <= 30) return 'orange';
      }
      if (epi.prochain_controle) {
        const d = daysUntil(epi.prochain_controle);
        if (d >= 0 && d <= 30) return 'orange';
      }
    }
    return null;
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  const stats = $derived({
    total: data.chauffeurs.length,
    complets: data.chauffeurs.filter((c) => getEquipmentStatus(c) === 'complet').length,
    incomplets: data.chauffeurs.filter((c) => getEquipmentStatus(c) === 'incomplet').length,
    nonEquipes: data.chauffeurs.filter((c) => getEquipmentStatus(c) === 'non_equipe').length,
  });

  // ── Filtres & tri ────────────────────────────────────────────────────
  let search = $state('');
  let filterStatus = $state('');
  let filterActivite = $state('');

  type SortCol = 'nom' | 'activite' | 'epis' | 'statut' | 'expiration';
  let sortCol = $state<SortCol>('statut');
  let sortDir = $state<'asc' | 'desc'>('asc');

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = 'asc';
    }
  }

  const statusRank: Record<string, number> = { complet: 0, incomplet: 1, non_equipe: 2 };
  const expirationRank = (c: Chauffeur) => {
    const level = getAlertLevel(c);
    if (level === 'red') return 0;
    if (level === 'orange') return 1;
    return 2;
  };

  const filtered = $derived.by(() => {
    const rows = data.chauffeurs.filter((c) => {
      const name = `${c.prenom} ${c.nom}`.toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (filterStatus && getEquipmentStatus(c) !== filterStatus) return false;
      if (filterActivite && c.activite !== filterActivite) return false;
      return true;
    });

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'nom') {
        cmp = `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr');
      } else if (sortCol === 'activite') {
        cmp = (a.activite ?? '').localeCompare(b.activite ?? '', 'fr');
      } else if (sortCol === 'epis') {
        cmp = a.epis.length - b.epis.length;
      } else if (sortCol === 'statut') {
        cmp = statusRank[getEquipmentStatus(a)] - statusRank[getEquipmentStatus(b)];
      } else if (sortCol === 'expiration') {
        cmp = expirationRank(a) - expirationRank(b);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  });

  // ── Panel de détail ───────────────────────────────────────────────────
  let showCreatePanel = $state(false);
  let createPrenom = $state('');
  let createNom = $state('');
  let createActivite = $state('');

  function openCreatePanel() {
    showCreatePanel = true;
    createPrenom = '';
    createNom = '';
    createActivite = '';
  }

  let selectedDriverId = $state<string | null>(null);
  const selectedDriver = $derived(
    selectedDriverId
      ? (data.chauffeurs.find((c) => c.id_chauffeur === selectedDriverId) ?? null)
      : null,
  );

  function openDriver(id: string) {
    selectedDriverId = id;
    editMode = false;
    confirmDelete = false;
    activeFilter = null;
    transferAllTarget = '';
    epiTransferTargets = {};
    epiTransferOpen = {};
    epiMenuOpen = {};
  }

  // Ouvre automatiquement la fiche d'un chauffeur si l'URL contient ?fiche=<id>
  // (utilisé par le bouton « Voir la fiche » de la page Attributions).
  let handledFiche = $state<string | null>(null);
  $effect(() => {
    const fiche = $page.url.searchParams.get('fiche');
    if (fiche && fiche !== handledFiche && data.chauffeurs.some((c) => c.id_chauffeur === fiche)) {
      handledFiche = fiche;
      openDriver(fiche);
    }
  });

  // ── Mode édition ──────────────────────────────────────────────────────
  let editMode = $state(false);
  let editPrenom = $state('');
  let editNom = $state('');
  let editActivite = $state('');

  const editChanged = $derived(
    selectedDriver !== null &&
      (editPrenom.trim() !== selectedDriver.prenom ||
        editNom.trim() !== selectedDriver.nom ||
        editActivite !== (selectedDriver.activite ?? '')),
  );

  function startEdit() {
    if (!selectedDriver) return;
    editPrenom = selectedDriver.prenom;
    editNom = selectedDriver.nom;
    editActivite = selectedDriver.activite ?? '';
    editMode = true;
  }

  // ── Suppression ───────────────────────────────────────────────────────
  let confirmDelete = $state(false);

  // ── Transferts ────────────────────────────────────────────────────────
  let transferAllTarget = $state('');
  let epiTransferTargets = $state<Record<string, string>>({});
  let epiTransferOpen = $state<Record<string, boolean>>({});
  let epiMenuOpen = $state<Record<string, boolean>>({});

  function toggleEpiTransfer(id_attribution: string) {
    epiTransferOpen = {
      ...epiTransferOpen,
      [id_attribution]: !epiTransferOpen[id_attribution],
    };
  }

  function toggleEpiMenu(id_attribution: string) {
    const wasOpen = epiMenuOpen[id_attribution];
    epiMenuOpen = {};
    if (!wasOpen) epiMenuOpen[id_attribution] = true;
  }

  const otherDrivers = $derived(
    selectedDriver
      ? data.chauffeurs.filter((c) => c.id_chauffeur !== selectedDriver.id_chauffeur)
      : [],
  );

  type EpiStatus = 'expired' | 'control_overdue' | 'expiring_soon' | 'control_soon' | 'ok';

  function getEpiStatus(epi: Chauffeur['epis'][0]): EpiStatus {
    const days = epi.date_expiration ? daysUntil(epi.date_expiration) : null;
    const controlDays = epi.prochain_controle ? daysUntil(epi.prochain_controle) : null;
    if (days !== null && days < 0) return 'expired';
    if (controlDays !== null && controlDays < 0) return 'control_overdue';
    if (days !== null && days <= 30) return 'expiring_soon';
    if (controlDays !== null && controlDays <= 30) return 'control_soon';
    return 'ok';
  }

  const STATUS_RANK: Record<EpiStatus, number> = {
    expired: 0,
    control_overdue: 1,
    expiring_soon: 2,
    control_soon: 3,
    ok: 4,
  };

  const sortedEpis = $derived.by(() => {
    if (!selectedDriver) return [];
    return [...selectedDriver.epis].sort(
      (a, b) => STATUS_RANK[getEpiStatus(a)] - STATUS_RANK[getEpiStatus(b)],
    );
  });

  const epiStatusCounts = $derived.by(() => {
    const counts: Record<EpiStatus, number> = {
      expired: 0,
      control_overdue: 0,
      expiring_soon: 0,
      control_soon: 0,
      ok: 0,
    };
    if (!selectedDriver) return counts;
    for (const epi of selectedDriver.epis) counts[getEpiStatus(epi)]++;
    return counts;
  });

  let activeFilter = $state<EpiStatus | null>(null);

  const filteredEpis = $derived.by(() => {
    if (!activeFilter) return sortedEpis;
    return sortedEpis.filter((epi) => getEpiStatus(epi) === activeFilter);
  });

  function toggleFilter(status: EpiStatus) {
    activeFilter = activeFilter === status ? null : status;
  }
</script>

<!-- ── PAGE ──────────────────────────────────────────────────────────────── -->
<div
  class="w-full max-w-7xl mx-auto p-4 lg:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700"
>
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4">
      <div class="p-3 rounded-2xl bg-blue-500 shadow-lg">
        <Users class="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 class="text-3xl font-black text-blue-600 tracking-tight uppercase">Chauffeurs</h1>
      </div>
    </div>
    <button
      onclick={openCreatePanel}
      class="px-5 py-2.5 rounded-2xl bg-blue-500 text-white text-sm font-black hover:bg-blue-400 transition-colors shadow-lg"
    >
      Ajouter un chauffeur
    </button>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 border-blue-400 flex items-center gap-4"
      style="background: linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)"
    >
      <Users class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0"
        >{stats.total}</span
      >
      <p class="text-blue-100 text-sm font-bold leading-snug">Chauffeurs au total</p>
    </div>

    <button
      onclick={() => (filterStatus = filterStatus === 'complet' ? '' : 'complet')}
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 text-left transition-all flex items-center gap-4
				{filterStatus === 'complet' ? 'border-emerald-300 ring-2 ring-emerald-300' : 'border-emerald-400'}"
      style="background: linear-gradient(135deg, #059669 0%, #34d399 100%)"
    >
      <ShieldCheck class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0"
        >{stats.complets}</span
      >
      <p class="text-emerald-100 text-sm font-bold leading-snug">Bien équipés</p>
    </button>

    <button
      onclick={() => (filterStatus = filterStatus === 'incomplet' ? '' : 'incomplet')}
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 text-left transition-all flex items-center gap-4
				{filterStatus === 'incomplet' ? 'border-amber-300 ring-2 ring-amber-300' : 'border-amber-400'}"
      style="background: linear-gradient(135deg, #d97706 0%, #fbbf24 100%)"
    >
      <ShieldAlert class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0"
        >{stats.incomplets}</span
      >
      <p class="text-amber-100 text-sm font-bold leading-snug">Partiellement équipés</p>
    </button>

    <button
      onclick={() => (filterStatus = filterStatus === 'non_equipe' ? '' : 'non_equipe')}
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 text-left transition-all flex items-center gap-4
				{filterStatus === 'non_equipe' ? 'border-red-300 ring-2 ring-red-300' : 'border-red-400'}"
      style="background: linear-gradient(135deg, #ef4444 0%, #f87171 100%)"
    >
      <ShieldX class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0"
        >{stats.nonEquipes}</span
      >
      <p class="text-red-100 text-sm font-bold leading-snug">Sans aucun équipement</p>
    </button>
  </div>

  <!-- Barre de recherche / filtre -->
  <div class="flex flex-col sm:flex-row gap-3">
    <input
      type="search"
      bind:value={search}
      placeholder="Rechercher un chauffeur…"
      class="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
    />
    <select
      bind:value={filterActivite}
      class="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-48"
    >
      <option value="">Toutes les activités</option>
      {#each ACTIVITES as act (act)}
        <option value={act}>{act}</option>
      {/each}
    </select>
    {#if filterStatus || filterActivite}
      <button
        onclick={() => {
          filterStatus = '';
          filterActivite = '';
        }}
        class="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-100 text-blue-700 text-sm font-bold hover:bg-blue-200 transition-colors"
      >
        <X class="w-3.5 h-3.5" />Effacer les filtres
      </button>
    {/if}
  </div>

  <!-- Tableau -->
  <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
    <!-- En-têtes -->
    <div
      class="grid items-center gap-4 px-6 py-2 border-b border-slate-100 bg-slate-50"
      style="grid-template-columns: 1fr 160px 80px 110px 130px 130px"
    >
      {#snippet sortBtn(col: SortCol, label: string, center = false)}
        <button
          onclick={() => toggleSort(col)}
          class="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors
						{sortCol === col ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}
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

      <div class="pl-10">{@render sortBtn('nom', 'Nom / Prénom')}</div>
      {@render sortBtn('activite', 'Activité', true)}
      {@render sortBtn('epis', 'EPI', true)}
      {@render sortBtn('statut', 'Statut', true)}
      {@render sortBtn('expiration', 'Alertes', true)}
      <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
        Actions
      </p>
    </div>

    {#if filtered.length === 0}
      <div class="flex flex-col items-center justify-center gap-3 py-16 opacity-30">
        <Users class="w-12 h-12 text-slate-400" />
        <p class="text-xs font-black uppercase tracking-widest">Aucun chauffeur trouvé</p>
      </div>
    {/if}

    {#each filtered as c (c.id_chauffeur)}
      {@const status = getEquipmentStatus(c)}
      <div
        role="row"
        tabindex="0"
        onclick={() => openDriver(c.id_chauffeur)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && openDriver(c.id_chauffeur)}
        class="cursor-pointer grid items-center gap-4 px-6 py-4 border-b border-slate-100 hover:bg-blue-50/40 transition-colors group"
        style="grid-template-columns: 1fr 160px 80px 110px 130px 130px"
      >
        <!-- Nom -->
        <div class="flex items-center gap-3 min-w-0">
          <div
            class="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center font-black text-white text-sm shrink-0"
          >
            {c.nom[0]?.toUpperCase()}
          </div>
          <div class="min-w-0">
            <p class="font-bold text-sm text-slate-900 truncate">{c.nom} {c.prenom}</p>
          </div>
        </div>

        <!-- Activité -->
        <div class="flex justify-center">
          {#if c.activite}
            <span
              class="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 truncate max-w-full"
            >
              {c.activite}
            </span>
          {:else}
            <span class="text-xs text-slate-300">—</span>
          {/if}
        </div>

        <!-- Nb EPI -->
        <div class="flex justify-center">
          <span
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 text-xs font-black text-slate-700"
          >
            <Package class="w-3 h-3" />
            {c.epis.length}
          </span>
        </div>

        <!-- Statut équipement -->
        <div class="flex justify-center">
          {#if status === 'complet'}
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700"
            >
              <ShieldCheck class="w-3 h-3" />Complet
            </span>
          {:else if status === 'incomplet'}
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700"
            >
              <ShieldAlert class="w-3 h-3" />Incomplet
            </span>
          {:else}
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-600"
            >
              <ShieldX class="w-3 h-3" />Non équipé
            </span>
          {/if}
        </div>

        <!-- Alertes -->
        <div class="flex items-center justify-center gap-1.5">
          {#if getAlertLevel(c) === 'red'}
            <span
              class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 border border-red-200 text-[11px] font-semibold text-red-600"
            >
              <TriangleAlert class="w-3 h-3" />Urgent
            </span>
          {:else if getAlertLevel(c) === 'orange'}
            <span
              class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-600"
            >
              <Clock class="w-3 h-3" />Bientôt
            </span>
          {:else}
            <span class="text-xs text-slate-300">—</span>
          {/if}
        </div>

        <!-- Actions rapides -->
        <div
          role="none"
          onclick={(e) => e.stopPropagation()}
          class="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <form
            method="POST"
            action="?/supprimer"
            use:enhance={async ({ cancel }) => {
              const ok = await confirmAction({
                title: 'Supprimer le chauffeur',
                message: `Supprimer ${c.nom} ${c.prenom} ? Ses EPI seront libérés.`,
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
            <input type="hidden" name="id_chauffeur" value={c.id_chauffeur} />
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
<!-- ── PANEL CRÉATION ─────────────────────────────────────────────────────── -->
{#if showCreatePanel}
  <button
    transition:fade={{ duration: 200 }}
    class="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
    onclick={() => (showCreatePanel = false)}
    aria-label="Fermer"
  ></button>

  <div
    in:fly={{ x: 560, duration: 380, easing: quintOut }}
    out:fly={{ x: 560, duration: 250, easing: cubicIn }}
    class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden"
  >
    <!-- En-tête -->
    <div class="p-6 bg-linear-to-br from-blue-600 to-blue-400 relative overflow-hidden shrink-0">
      <UserPlus class="absolute -right-4 -bottom-4 w-32 h-32 text-white/5" />
      <div class="relative z-10 flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div
            class="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center font-black text-white text-xl"
          >
            {#if createPrenom || createNom}
              {(createPrenom[0] ?? '').toUpperCase()}{(createNom[0] ?? '').toUpperCase()}
            {:else}
              ?
            {/if}
          </div>
          <div>
            <h2 class="text-xl font-black text-white tracking-tight">
              {createPrenom || createNom
                ? `${createPrenom} ${createNom}`.trim()
                : 'Nouveau chauffeur'}
            </h2>
            <p class="text-blue-200 text-xs font-bold mt-0.5">
              {createActivite || 'Activité non renseignée'}
            </p>
          </div>
        </div>
        <button
          onclick={() => (showCreatePanel = false)}
          class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Corps -->
    <form
      method="POST"
      action="?/creer_chauffeur"
      use:enhance={({ cancel }) => {
        if (!createPrenom.trim() || !createNom.trim()) {
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
      <div class="flex-1 p-6 space-y-6">
        <!-- Identité -->
        <div class="space-y-4">
          <p class="text-[11px] font-black uppercase tracking-widest text-slate-400">Identité</p>

          <div class="space-y-1.5">
            <label
              for="create-nom"
              class="text-xs font-black uppercase tracking-widest text-slate-500"
              >Nom <span class="text-red-400">*</span></label
            >
            <input
              id="create-nom"
              name="nom"
              type="text"
              required
              autocomplete="family-name"
              bind:value={createNom}
              placeholder="Dupont"
              class="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div class="space-y-1.5">
            <label
              for="create-prenom"
              class="text-xs font-black uppercase tracking-widest text-slate-500"
              >Prénom <span class="text-red-400">*</span></label
            >
            <input
              id="create-prenom"
              name="prenom"
              type="text"
              required
              autocomplete="given-name"
              bind:value={createPrenom}
              placeholder="Jean"
              class="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        <!-- Activité -->
        <div class="space-y-3">
          <p class="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Activité <span class="text-slate-300 font-medium normal-case tracking-normal"
              >(optionnel)</span
            >
          </p>
          <input type="hidden" name="activite" value={createActivite} />

          <button
            type="button"
            onclick={() => (createActivite = '')}
            class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all
              {createActivite === ''
              ? 'border-slate-300 bg-slate-50'
              : 'border-slate-100 hover:border-slate-200'}"
          >
            <div class="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <span class="text-sm font-black text-slate-400">—</span>
            </div>
            <span
              class="text-sm font-bold {createActivite === ''
                ? 'text-slate-700'
                : 'text-slate-400'}">Aucune</span
            >
            {#if createActivite === ''}<div
                class="ml-auto w-2 h-2 rounded-full bg-slate-400"
              ></div>{/if}
          </button>

          {#each ACTIVITES as act (act)}
            <button
              type="button"
              onclick={() => (createActivite = act)}
              class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all
                {createActivite === act
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-slate-100 hover:border-slate-200'}"
            >
              <div
                class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 {createActivite ===
                act
                  ? 'bg-indigo-500'
                  : 'bg-slate-100'}"
              >
                <Package
                  class="w-4 h-4 {createActivite === act ? 'text-white' : 'text-slate-400'}"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-bold {createActivite === act
                    ? 'text-indigo-700'
                    : 'text-slate-600'}"
                >
                  {act}
                </p>
                <p class="text-[11px] text-slate-400">{PRESETS[act]?.join(' · ') ?? ''}</p>
              </div>
              {#if createActivite === act}<div
                  class="w-2 h-2 rounded-full bg-indigo-500 shrink-0"
                ></div>{/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Pied -->
      <div class="shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex items-center gap-3">
        <button
          type="submit"
          class="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 transition-colors shadow-lg"
        >
          <UserPlus class="w-4 h-4" />Ajouter le chauffeur
        </button>
        <button
          type="button"
          onclick={() => (showCreatePanel = false)}
          class="px-5 py-3 rounded-2xl border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- ── PANEL DE DÉTAIL ────────────────────────────────────────────────────── -->
{#if selectedDriver}
  <!-- Backdrop -->
  <button
    transition:fade={{ duration: 200 }}
    class="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
    onclick={() => (selectedDriverId = null)}
    aria-label="Fermer"
  ></button>

  <!-- Panel -->
  <div
    in:fly={{ x: 560, duration: 380, easing: quintOut }}
    out:fly={{ x: 560, duration: 250, easing: cubicIn }}
    class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden"
  >
    <!-- En-tête du panel -->
    <div class="p-6 bg-linear-to-br from-blue-600 to-blue-400 relative overflow-hidden shrink-0">
      <Users class="absolute -right-4 -bottom-4 w-32 h-32 text-white/5" />
      <div class="relative z-10 flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div
            class="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center font-black text-white text-xl"
          >
            {selectedDriver.nom[0]?.toUpperCase()}
          </div>
          <div>
            <h2 class="text-xl font-black text-white tracking-tight">
              {selectedDriver.nom}
              {selectedDriver.prenom}
            </h2>
            <p class="text-blue-200 text-xs font-bold mt-0.5">
              {selectedDriver.activite ?? 'Activité non renseignée'}
            </p>
          </div>
        </div>
        <button
          onclick={() => (selectedDriverId = null)}
          class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Statut + badge expiration -->
      <div class="relative z-10 flex items-center gap-2 mt-4 flex-wrap">
        {#if getEquipmentStatus(selectedDriver) === 'complet'}
          <span
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-black text-emerald-200 uppercase"
          >
            <ShieldCheck class="w-3.5 h-3.5" />Équipement complet
          </span>
        {:else if getEquipmentStatus(selectedDriver) === 'incomplet'}
          <span
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-[11px] font-black text-amber-200 uppercase"
          >
            <ShieldAlert class="w-3.5 h-3.5" />Équipement incomplet
          </span>
        {:else}
          <span
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-400/30 text-[11px] font-black text-red-200 uppercase"
          >
            <ShieldX class="w-3.5 h-3.5" />Non équipé
          </span>
        {/if}
      </div>
    </div>

    <!-- Corps du panel (scrollable) -->
    <div class="flex-1 overflow-y-auto" role="none" onclick={() => (epiMenuOpen = {})}>
      <!-- ── Mode édition ─────────────────────────────────────────── -->
      {#if editMode}
        <div class="p-6">
          <form
            id="edit-chauffeur-form"
            method="POST"
            action="?/modifier_chauffeur"
            use:enhance={({ cancel }) => {
              if (!editPrenom.trim() || !editNom.trim()) {
                cancel();
                return;
              }
              return ({ update }) => {
                editMode = false;
                update();
              };
            }}
            class="space-y-4"
          >
            <input type="hidden" name="id_chauffeur" value={selectedDriver.id_chauffeur} />
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label
                  for="edit-prenom"
                  class="text-xs font-black uppercase tracking-widest text-slate-500 block"
                  >Prénom</label
                >
                <input
                  id="edit-prenom"
                  name="prenom"
                  bind:value={editPrenom}
                  required
                  class="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
              <div class="space-y-1.5">
                <label
                  for="edit-nom"
                  class="text-xs font-black uppercase tracking-widest text-slate-500 block"
                  >Nom</label
                >
                <input
                  id="edit-nom"
                  name="nom"
                  bind:value={editNom}
                  required
                  class="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <label
                for="edit-activite"
                class="text-xs font-black uppercase tracking-widest text-slate-500 block"
                >Activité</label
              >
              <select
                id="edit-activite"
                name="activite"
                bind:value={editActivite}
                class="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all appearance-none"
              >
                <option value="">— Non renseignée —</option>
                {#each ACTIVITES as a (a)}
                  <option value={a}>{a}</option>
                {/each}
              </select>
            </div>
          </form>
        </div>
      {:else}
        <!-- ── Liste des EPI ─────────────────────────────────────────── -->
        <div class="p-5 space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">
              EPI attribués ({selectedDriver.epis.length})
            </p>
          </div>

          {#if selectedDriver.epis.length === 0}
            <div class="flex flex-col items-center gap-2 py-8 opacity-30">
              <Package class="w-10 h-10 text-slate-400" />
              <p class="text-xs font-black uppercase tracking-widest">Aucun EPI attribué</p>
            </div>
          {:else}
            {#snippet epiCard(epi: (typeof selectedDriver.epis)[0])}
              {@const status = getEpiStatus(epi)}
              {@const days = epi.date_expiration ? daysUntil(epi.date_expiration) : null}
              {@const controlDays = epi.prochain_controle ? daysUntil(epi.prochain_controle) : null}
              <div
                class="rounded-2xl border bg-white shadow-sm
                {status === 'expired' || status === 'control_overdue'
                  ? 'border-red-200'
                  : status === 'expiring_soon' || status === 'control_soon'
                    ? 'border-orange-200'
                    : 'border-slate-100'}"
              >
                <div class="flex">
                  <div
                    role="button"
                    tabindex="0"
                    onclick={() => goto('/epi?fiche=' + epi.id_epi)}
                    onkeydown={(e) =>
                      (e.key === 'Enter' || e.key === ' ') && goto('/epi?fiche=' + epi.id_epi)}
                    class="flex-1 min-w-0 cursor-pointer hover:bg-slate-50/60 transition-colors rounded-l-2xl"
                  >
                    <div class="px-3 py-3 flex items-start gap-2">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <p class="font-bold text-sm text-slate-900">{epi.designation}</p>
                          {#if epi.taille}
                            <span
                              class="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full"
                              >{epi.taille}</span
                            >
                          {/if}
                        </div>
                        <p
                          class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5"
                        >
                          {epi.type}
                        </p>

                        {#if status === 'expired'}
                          <p
                            class="text-[10px] font-bold text-red-500 mt-1.5 flex items-center gap-1"
                          >
                            <Clock class="w-3 h-3 shrink-0" />{formatDate(epi.date_expiration)}
                          </p>
                        {:else if status === 'control_overdue'}
                          <p
                            class="text-[10px] font-bold text-red-600 mt-1.5 flex items-center gap-1"
                          >
                            <Wrench class="w-3 h-3 shrink-0" />Contrôle dû le {formatDate(
                              epi.prochain_controle,
                            )}
                          </p>
                        {:else if status === 'expiring_soon'}
                          <p
                            class="text-[10px] font-bold text-orange-500 mt-1.5 flex items-center gap-1"
                          >
                            <Clock class="w-3 h-3 shrink-0" />Dans {days} jour{days !== 1
                              ? 's'
                              : ''} · {formatDate(epi.date_expiration)}
                          </p>
                        {:else if status === 'control_soon'}
                          <p
                            class="text-[10px] font-bold text-amber-500 mt-1.5 flex items-center gap-1"
                          >
                            <Wrench class="w-3 h-3 shrink-0" />Contrôle dans {controlDays} jour{controlDays !==
                            1
                              ? 's'
                              : ''} · {formatDate(epi.prochain_controle)}
                          </p>
                        {:else if epi.date_expiration || epi.prochain_controle}
                          <div class="flex items-center gap-3 mt-1 flex-wrap">
                            {#if epi.date_expiration}
                              <span
                                class="text-[10px] text-slate-300 font-medium flex items-center gap-0.5"
                              >
                                <Clock class="w-3 h-3" />{formatDate(epi.date_expiration)}
                              </span>
                            {/if}
                            {#if epi.prochain_controle}
                              <span
                                class="text-[10px] text-slate-300 font-medium flex items-center gap-0.5"
                              >
                                <Wrench class="w-3 h-3" />{formatDate(epi.prochain_controle)}
                              </span>
                            {/if}
                          </div>
                        {/if}
                      </div>

                      <div class="flex items-center gap-1 shrink-0 mt-0.5">
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap
                          {status === 'expired'
                            ? 'bg-red-100 text-red-600'
                            : status === 'control_overdue'
                              ? 'bg-red-50 border border-red-200 text-red-700'
                              : status === 'expiring_soon'
                                ? 'bg-orange-100 text-orange-600'
                                : status === 'control_soon'
                                  ? 'bg-amber-100 text-amber-600'
                                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}"
                        >
                          {#if status === 'expired'}
                            <TriangleAlert class="w-2.5 h-2.5" />Expiré
                          {:else if status === 'control_overdue'}
                            <Wrench class="w-2.5 h-2.5" />Contrôle dépassé
                          {:else if status === 'expiring_soon'}
                            <Clock class="w-2.5 h-2.5" />Expiration proche
                          {:else if status === 'control_soon'}
                            <Wrench class="w-2.5 h-2.5" />Contrôle proche
                          {:else}
                            <ShieldCheck class="w-2.5 h-2.5" />En ordre
                          {/if}
                        </span>

                        <div role="none" class="relative" onclick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onclick={() => toggleEpiMenu(epi.id_attribution)}
                            class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <Ellipsis class="w-4 h-4" />
                          </button>

                          {#if epiMenuOpen[epi.id_attribution]}
                            <div
                              class="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-10"
                            >
                              <form
                                method="POST"
                                action="?/retirer_epi"
                                use:enhance={async ({ cancel }) => {
                                  const ok = await confirmAction({
                                    title: "Retirer l'EPI",
                                    message: `Retirer "${epi.designation}" de ce chauffeur ?`,
                                    confirmLabel: 'Retirer',
                                    confirmVariant: 'danger',
                                  });
                                  if (!ok) {
                                    cancel();
                                    return;
                                  }
                                  return ({ update }) => {
                                    epiMenuOpen = {};
                                    update();
                                  };
                                }}
                              >
                                <input
                                  type="hidden"
                                  name="id_attribution"
                                  value={epi.id_attribution}
                                />
                                <input type="hidden" name="id_epi" value={epi.id_epi} />
                                <button
                                  type="submit"
                                  class="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors text-left"
                                >
                                  <X class="w-3.5 h-3.5" />Retirer
                                </button>
                              </form>
                              {#if status !== 'expired'}
                                <form
                                  method="POST"
                                  action="?/hors_service"
                                  use:enhance={async ({ cancel }) => {
                                    const ok = await confirmAction({
                                      title: 'Mettre hors service',
                                      message: `Marquer "${epi.designation}" comme hors service ? Il sera désattribué et le stock diminuera de 1.`,
                                      confirmLabel: 'Confirmer',
                                      confirmVariant: 'danger',
                                    });
                                    if (!ok) {
                                      cancel();
                                      return;
                                    }
                                    return ({ update }) => {
                                      epiMenuOpen = {};
                                      update();
                                    };
                                  }}
                                >
                                  <input
                                    type="hidden"
                                    name="id_attribution"
                                    value={epi.id_attribution}
                                  />
                                  <input type="hidden" name="id_epi" value={epi.id_epi} />
                                  <button
                                    type="submit"
                                    class="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
                                  >
                                    <ShieldX class="w-3.5 h-3.5" />Hors service
                                  </button>
                                </form>
                              {/if}
                              <button
                                type="button"
                                onclick={() => {
                                  toggleEpiTransfer(epi.id_attribution);
                                  epiMenuOpen = {};
                                }}
                                class="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 transition-colors text-left"
                              >
                                <ArrowRightLeft class="w-3.5 h-3.5" />Transférer
                              </button>
                            </div>
                          {/if}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {#if epiTransferOpen[epi.id_attribution]}
                  <div class="px-4 pb-4 bg-indigo-50/50 border-t border-indigo-100">
                    <form
                      method="POST"
                      action="?/transferer_epi"
                      use:enhance={({ cancel }) => {
                        if (!epiTransferTargets[epi.id_attribution]) {
                          cancel();
                          return;
                        }
                        return ({ update }) => {
                          epiTransferOpen = { ...epiTransferOpen, [epi.id_attribution]: false };
                          update();
                        };
                      }}
                      class="flex gap-2 pt-3"
                    >
                      <input type="hidden" name="id_attribution" value={epi.id_attribution} />
                      <input type="hidden" name="id_epi" value={epi.id_epi} />
                      <select
                        name="id_chauffeur_dest"
                        bind:value={epiTransferTargets[epi.id_attribution]}
                        class="flex-1 px-3 py-2 rounded-xl border border-indigo-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      >
                        <option value="">Choisir un chauffeur…</option>
                        {#each otherDrivers as d (d.id_chauffeur)}
                          <option value={d.id_chauffeur}>{d.nom} {d.prenom}</option>
                        {/each}
                      </select>
                      <button
                        type="submit"
                        disabled={!epiTransferTargets[epi.id_attribution]}
                        class="px-3 py-2 rounded-xl bg-indigo-700 text-white text-xs font-black hover:bg-indigo-600 transition-colors disabled:opacity-40 shrink-0"
                      >
                        OK
                      </button>
                    </form>
                  </div>
                {/if}
              </div>
            {/snippet}

            <!-- Résumé par statut / filtres -->
            <div class="flex items-center gap-2 flex-wrap pb-2">
              {#if epiStatusCounts.expired > 0}
                <button
                  onclick={() => toggleFilter('expired')}
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition-all cursor-pointer
                  {activeFilter === 'expired'
                    ? 'bg-red-500 border-red-500 text-white shadow-md scale-105'
                    : 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200'}"
                >
                  <TriangleAlert class="w-3.5 h-3.5" />{epiStatusCounts.expired} expiré{epiStatusCounts.expired >
                  1
                    ? 's'
                    : ''}
                </button>
              {/if}
              {#if epiStatusCounts.control_overdue > 0}
                <button
                  onclick={() => toggleFilter('control_overdue')}
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition-all cursor-pointer
                  {activeFilter === 'control_overdue'
                    ? 'bg-red-800 border-red-800 text-white shadow-md scale-105'
                    : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'}"
                >
                  <Wrench class="w-3.5 h-3.5" />{epiStatusCounts.control_overdue} contrôle{epiStatusCounts.control_overdue >
                  1
                    ? 's'
                    : ''} dépassé{epiStatusCounts.control_overdue > 1 ? 's' : ''}
                </button>
              {/if}
              {#if epiStatusCounts.expiring_soon > 0}
                <button
                  onclick={() => toggleFilter('expiring_soon')}
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition-all cursor-pointer
                  {activeFilter === 'expiring_soon'
                    ? 'bg-orange-400 border-orange-400 text-white shadow-md scale-105'
                    : 'bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200'}"
                >
                  <Clock class="w-3.5 h-3.5" />{epiStatusCounts.expiring_soon} expiration{epiStatusCounts.expiring_soon >
                  1
                    ? 's'
                    : ''} proche{epiStatusCounts.expiring_soon > 1 ? 's' : ''}
                </button>
              {/if}
              {#if epiStatusCounts.control_soon > 0}
                <button
                  onclick={() => toggleFilter('control_soon')}
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition-all cursor-pointer
                  {activeFilter === 'control_soon'
                    ? 'bg-amber-400 border-amber-400 text-white shadow-md scale-105'
                    : 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'}"
                >
                  <Wrench class="w-3.5 h-3.5" />{epiStatusCounts.control_soon} contrôle{epiStatusCounts.control_soon >
                  1
                    ? 's'
                    : ''} proche{epiStatusCounts.control_soon > 1 ? 's' : ''}
                </button>
              {/if}
              {#if epiStatusCounts.ok > 0}
                <button
                  onclick={() => toggleFilter('ok')}
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition-all cursor-pointer
                  {activeFilter === 'ok'
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-md scale-105'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}"
                >
                  <ShieldCheck class="w-3.5 h-3.5" />{epiStatusCounts.ok} en ordre
                </button>
              {/if}
            </div>

            <div class="space-y-2">
              {#each filteredEpis as epi (epi.id_attribution)}
                <div in:fly={{ y: 8, duration: 200 }} out:fade={{ duration: 120 }}>
                  {@render epiCard(epi)}
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- ── EPI manquants ─────────────────────────────────────────── -->
        {#if getMissingEpis(selectedDriver).length > 0}
          <div class="px-5 pb-5">
            <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p class="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-3">
                EPI manquants selon le preset "{selectedDriver.activite}"
              </p>
              <div class="flex flex-wrap gap-2">
                {#each getMissingEpis(selectedDriver) as kw (kw)}
                  <span
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-amber-300 text-xs font-bold text-amber-700"
                  >
                    <Plus class="w-3 h-3" />{kw}
                  </span>
                {/each}
              </div>
            </div>
          </div>
        {/if}

        <!-- ── Transférer tout le matériel ─────────────────────────── -->
        {#if selectedDriver.epis.length > 0}
          <div class="px-5 pb-6">
            <details class="group">
              <summary
                class="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer select-none transition-colors list-none w-full"
              >
                <ArrowRightLeft class="w-3.5 h-3.5 shrink-0" />
                Transférer tout le matériel
              </summary>
              <form
                method="POST"
                action="?/transferer_tout"
                use:enhance={async ({ cancel }) => {
                  if (!transferAllTarget) {
                    cancel();
                    return;
                  }
                  const dest = data.chauffeurs.find((c) => c.id_chauffeur === transferAllTarget);
                  const ok = await confirmAction({
                    title: 'Transférer tout le matériel',
                    message: `Transférer tous les EPI de ${selectedDriver?.nom} ${selectedDriver?.prenom} vers ${dest?.nom} ${dest?.prenom} ?`,
                    confirmLabel: 'Transférer',
                    confirmVariant: 'danger',
                  });
                  if (!ok) {
                    cancel();
                    return;
                  }
                  return ({ update }) => {
                    transferAllTarget = '';
                    update();
                  };
                }}
                class="flex gap-2 mt-3"
              >
                <input type="hidden" name="id_chauffeur_src" value={selectedDriver.id_chauffeur} />
                <select
                  name="id_chauffeur_dest"
                  bind:value={transferAllTarget}
                  class="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white text-slate-600"
                >
                  <option value="">Choisir un chauffeur…</option>
                  {#each otherDrivers as d (d.id_chauffeur)}
                    <option value={d.id_chauffeur}>{d.nom} {d.prenom}</option>
                  {/each}
                </select>
                <button
                  type="submit"
                  disabled={!transferAllTarget}
                  class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 text-slate-600 text-xs font-black hover:bg-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <ArrowRightLeft class="w-3.5 h-3.5" />Transférer tout
                </button>
              </form>
            </details>
          </div>
        {/if}
      {/if}
    </div>

    <!-- ── Pied du panel ──────────────────────────────────────────────── -->
    <div
      class="shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3"
    >
      {#if editMode}
        <div class="flex items-center gap-2">
          <button
            type="submit"
            form="edit-chauffeur-form"
            disabled={!editChanged}
            class="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-500 text-white text-sm font-black transition-colors
              {editChanged ? 'hover:bg-blue-400' : 'opacity-40 cursor-not-allowed'}"
          >
            <Save class="w-4 h-4" />Enregistrer
          </button>
          <button
            type="button"
            onclick={() => (editMode = false)}
            class="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-700 text-sm font-black hover:bg-slate-200 transition-colors"
          >
            Annuler
          </button>
        </div>
      {:else}
        <div class="flex items-center gap-2">
          <a
            href="/attributions?chauffeur={selectedDriver.id_chauffeur}"
            class="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 transition-colors"
          >
            <Plus class="w-4 h-4" />Équiper
          </a>
          <button
            onclick={startEdit}
            class="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-700 text-sm font-black hover:bg-slate-200 transition-colors"
          >
            <Pencil class="w-4 h-4" />Modifier
          </button>
        </div>

        {#if !confirmDelete}
          <button
            onclick={() => (confirmDelete = true)}
            class="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-50 text-red-600 text-sm font-black hover:bg-red-100 transition-colors border border-red-200"
          >
            <Trash2 class="w-4 h-4" />Supprimer
          </button>
        {:else}
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-red-600">Confirmer la suppression ?</span>
            <form
              method="POST"
              action="?/supprimer"
              use:enhance={() =>
                ({ update }) => {
                  selectedDriverId = null;
                  update();
                }}
            >
              <input type="hidden" name="id_chauffeur" value={selectedDriver.id_chauffeur} />
              <button
                type="submit"
                class="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-black hover:bg-red-700 transition-colors"
              >
                Oui, supprimer
              </button>
            </form>
            <button
              onclick={() => (confirmDelete = false)}
              class="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-black hover:bg-slate-200 transition-colors"
            >
              Annuler
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}
