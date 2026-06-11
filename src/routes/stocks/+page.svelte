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
  } from 'lucide-svelte';
  import { fly, fade } from 'svelte/transition';
  import { quintOut, cubicIn } from 'svelte/easing';

  let { data }: { data: PageData } = $props();

  type Modele = (typeof data.modeles)[0];

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';

  // ── État ───────────────────────────────────────────────────────────────
  let panneauOuvert = $state(false);
  let modeleEnEdition = $state<Modele | null>(null);
  let panneauHistorique = $state(false);
  let modeEcheance = $state<'expiration' | 'controle'>('expiration');
  let dateValeur = $state('');
  let recherche = $state('');
  let filtreType = $state('');
  let filtreAlerte = $state('');
  let triColonne = $state<'designation' | 'type' | 'taille'>('designation');
  let triAsc = $state(true);
  let loading = $state(false);

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
      map[m.id_modele_epi] = Math.max(0, m.stock_total - (data.indisponiblesParModele[m.id_modele_epi] ?? 0));
    }
    return map;
  });

  const stats = $derived({
    totalModeles: data.modeles.length,
    disponibles: data.modeles.reduce((s, m) => s + Math.max(0, m.stock_total - (data.indisponiblesParModele[m.id_modele_epi] ?? 0)), 0),
    attribues: data.totalAttribues,
    alertes: data.modeles.filter((m) => Math.max(0, m.stock_total - (data.indisponiblesParModele[m.id_modele_epi] ?? 0)) <= m.seuil_alerte).length,
  });

  const allTypes = $derived(
    [...new Set(data.modeles.map((m) => m.type).filter(Boolean))].sort() as string[],
  );

  type SortCol = 'designation' | 'type' | 'taille';
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
      const va = a[triColonne] ?? '';
      const vb = b[triColonne] ?? '';
      const cmp = String(va).localeCompare(String(vb), 'fr');
      return triAsc ? cmp : -cmp;
    });
  });

  // Badge d'alerte basé sur le nombre réel d'unités disponibles.
  function getBadgeAlerte(modele: Modele, disponibles: number) {
    if (disponibles === 0) return { label: 'Rupture', class: 'bg-red-100 text-red-700' };
    const ratio = modele.seuil_alerte > 0 ? disponibles / modele.seuil_alerte : Infinity;
    if (ratio <= 0.4) return { label: 'Critique', class: 'bg-orange-100 text-orange-700' };
    if (disponibles <= modele.seuil_alerte * 0.5)
      return { label: 'Bas', class: 'bg-amber-100 text-amber-700' };
    return { label: 'OK', class: 'bg-emerald-100 text-emerald-700' };
  }


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
      <div class="p-3 rounded-2xl bg-amber-500 shadow-lg">
        <Boxes class="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 class="text-2xl lg:text-3xl font-black text-amber-900 tracking-tight">
          Stocks &amp; Inventaire
        </h1>
        <p class="text-sm text-slate-500">Gestion des EPI et de leurs stocks</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick={() => (panneauHistorique = true)}
        class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-amber-200 text-amber-700 bg-white text-sm font-bold hover:bg-amber-50 transition-colors"
      >
        <History class="w-4 h-4" />Historique
      </button>
      <button
        onclick={ouvrirCreation}
        class="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors shadow-lg"
      >
        <Plus class="w-4 h-4" />Nouvelle référence EPI
      </button>
    </div>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl flex items-center gap-4"
      style="background: linear-gradient(90deg, #92400e 0%, #b45309 100%)"
    >
      <Boxes class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0">{stats.totalModeles}</span>
      <p class="text-amber-200 text-sm font-bold leading-snug">Références EPI</p>
    </div>

    <div
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl flex items-center gap-4"
      style="background: linear-gradient(90deg, #b45309 0%, #d97706 100%)"
    >
      <CircleCheck class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0">{stats.disponibles}</span>
      <p class="text-amber-100 text-sm font-bold leading-snug">Unités disponibles</p>
    </div>

    <div
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl flex items-center gap-4"
      style="background: linear-gradient(90deg, #d97706 0%, #f59e0b 100%)"
    >
      <UserCheck class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0">{stats.attribues}</span>
      <p class="text-amber-100 text-sm font-bold leading-snug">Unités attribuées</p>
    </div>

    <div
      class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl flex items-center gap-4"
      style={stats.alertes > 0
        ? 'background: linear-gradient(90deg, #b91c1c 0%, #dc2626 100%)'
        : 'background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'}
    >
      <TriangleAlert class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
      <span class="text-4xl font-black text-white tabular-nums leading-none shrink-0">{stats.alertes}</span>
      <p class="text-sm font-bold leading-snug {stats.alertes > 0 ? 'text-red-100' : 'text-amber-100'}">Alertes stock</p>
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
        class="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm font-medium shadow-sm focus:border-transparent focus:ring-2 focus:ring-amber-400 focus:outline-none"
      />
    </div>
    <select
      bind:value={filtreType}
      class="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-40"
    >
      <option value="">Tous les types</option>
      {#each allTypes as t (t)}
        <option value={t}>{t}</option>
      {/each}
    </select>
    <select
      bind:value={filtreAlerte}
      class="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-40"
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
      style="grid-template-columns: 1.4fr 130px 80px 110px 120px 90px 90px 56px"
    >
      {#snippet sortBtn(col: SortCol, label: string, center = false)}
        <button
          onclick={() => toggleSort(col)}
          class="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest transition-colors
            {triColonne === col ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'}
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
      <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 text-center">
        Seuil
      </p>
      <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 text-center">
        Alerte
      </p>
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
      {#each modelesFiltres as modele (modele.id_modele_epi)}
        {@const dispo = disponiblesParModele[modele.id_modele_epi] ?? 0}
        {@const pct = modele.stock_total > 0 ? Math.round((dispo / modele.stock_total) * 100) : 0}
        {@const badge = getBadgeAlerte(modele, dispo)}
        <div
          class="grid items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group"
          style="grid-template-columns: 1.4fr 130px 80px 110px 120px 90px 90px 56px"
        >
          <!-- Désignation -->
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
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
          <div class="text-center text-sm font-semibold text-slate-700 tabular-nums">
            {dispo} <span class="text-slate-400 font-normal">/ {modele.stock_total}</span>
          </div>

          <!-- Stock (barre) -->
          <div class="flex justify-center">
            <div class="w-24 bg-gray-200 rounded-full h-2">
              <div
                class="h-2 rounded-full transition-all"
                style="width: {pct}%"
                class:bg-red-500={pct === 0}
                class:bg-orange-500={pct > 0 && pct <= 30}
                class:bg-amber-400={pct > 30 && pct <= 60}
                class:bg-emerald-500={pct > 60}
              ></div>
            </div>
          </div>

          <!-- Seuil -->
          <div class="flex items-center justify-center gap-1.5 text-sm text-slate-700 tabular-nums">
            {modele.seuil_alerte}
            {#if badge.label !== 'OK'}
              <TriangleAlert class="w-3.5 h-3.5 text-red-500" />
            {/if}
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
              class="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
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
    <div class="p-6 bg-linear-to-br from-amber-600 to-amber-500 relative overflow-hidden shrink-0">
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
            <p class="text-amber-100 text-xs mt-0.5">
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
          <p class="text-[11px] font-bold uppercase tracking-widest text-amber-600">
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
              class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 focus:bg-white transition-all"
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
                class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 focus:bg-white transition-all"
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
                class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>

        <!-- Section 2 — Stock -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <p class="text-[11px] font-bold uppercase tracking-widest text-amber-600">
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
                class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 focus:bg-white transition-all"
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
                class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 focus:bg-white transition-all"
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
                class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 focus:bg-white transition-all"
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
            <p class="text-[11px] font-bold uppercase tracking-widest text-amber-600">
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
                class:text-amber-700={modeEcheance === 'expiration'}
                class="rounded-lg py-2 px-3 text-sm font-medium transition-all text-slate-500"
              >
                📅 Date d'expiration
              </button>
              <button
                type="button"
                onclick={() => setMode('controle')}
                class:bg-white={modeEcheance === 'controle'}
                class:shadow-sm={modeEcheance === 'controle'}
                class:text-amber-700={modeEcheance === 'controle'}
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
                    class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 focus:bg-white transition-all"
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
                    class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 focus:bg-white transition-all"
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
                    class="flex-1 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
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
                  class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 focus:bg-white transition-all resize-none"
                ></textarea>
              </div>
            {/if}

            <!-- Note -->
            <div
              class="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3"
            >
              <Info class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p class="text-xs text-amber-700">
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
          class="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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

<!-- ── PANNEAU HISTORIQUE ──────────────────────────────────────────────────── -->
{#if panneauHistorique}
  <button
    transition:fade={{ duration: 200 }}
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
    onclick={() => (panneauHistorique = false)}
    aria-label="Fermer"
  ></button>

  <div
    in:fly={{ x: 400, duration: 350, easing: quintOut }}
    out:fly={{ x: 400, duration: 250, easing: cubicIn }}
    class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-80 bg-white shadow-2xl flex flex-col overflow-hidden"
  >
    <div class="p-5 bg-linear-to-br from-amber-600 to-amber-500 relative overflow-hidden shrink-0">
      <History class="absolute -right-3 -bottom-3 w-24 h-24 text-white/5" />
      <div class="relative z-10 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <History class="w-5 h-5 text-white" />
          <h2 class="text-base font-bold text-white">Historique des stocks</h2>
        </div>
        <button
          onclick={() => (panneauHistorique = false)}
          class="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <X class="w-4.5 h-4.5" />
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/60">
      {#if data.historiques.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-16 opacity-30">
          <History class="w-10 h-10 text-slate-400" />
          <p class="text-xs font-bold uppercase tracking-widest">Aucun mouvement</p>
        </div>
      {/if}
      {#each data.historiques as h (h.id_historique)}
        {@const hausse = h.nouvelle_valeur > h.ancienne_valeur}
        {@const designation = Array.isArray(h.modele_epi)
          ? h.modele_epi[0]?.designation
          : h.modele_epi?.designation}
        <div class="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <p class="text-sm font-semibold text-slate-800 truncate">{designation ?? '—'}</p>
            <span class="text-[10px] text-slate-400 tabular-nums shrink-0">
              {formatDate(h.date_modification)}
            </span>
          </div>
          <div class="flex items-center gap-2">
            {#if hausse}
              <ArrowUp class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            {:else}
              <ArrowDown class="w-3.5 h-3.5 text-red-500 shrink-0" />
            {/if}
            <span class="text-xs font-medium text-slate-600 tabular-nums">
              {h.ancienne_valeur} → {h.nouvelle_valeur}
            </span>
            {#if h.motif}
              <span
                class="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 truncate"
              >
                {h.motif}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
