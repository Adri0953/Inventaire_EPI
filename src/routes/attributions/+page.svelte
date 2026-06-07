<script lang="ts">
  import type { PageData } from './$types';
  import type { BodyZone } from '$lib/types/attributions';
  import DriverGrid from '$lib/components/attributions/DriverGrid.svelte';
  import BodySilhouette from '$lib/components/attributions/BodySilhouette.svelte';
  import EpiPanel from '$lib/components/attributions/EpiPanel.svelte';
  import { ShieldCheck, Users } from 'lucide-svelte';
  import { fade } from 'svelte/transition';

  let { data }: { data: PageData } = $props();

  // ── État de la page (la BD est la source de vérité) ───────────────────────
  let selectedDriverId = $state<string | null>(null);
  let selectedZone = $state<BodyZone | null>(null);

  // Zone à faire pulser après une validation (réinitialisée par minuterie).
  let pulseZone = $state<BodyZone | null>(null);
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;

  // Données dérivées des résultats du load() Supabase.
  const selectedDriver = $derived(
    selectedDriverId ? (data.drivers.find((d) => d.id === selectedDriverId) ?? null) : null,
  );
  const currentAttribution = $derived(
    selectedDriver ? (data.attributionsByDriver[selectedDriver.id] ?? {}) : {},
  );
  const epiForZone = $derived(
    selectedZone ? data.epiCatalog.filter((e) => e.zone === selectedZone) : [],
  );
  const currentForZone = $derived(selectedZone ? (currentAttribution[selectedZone] ?? []) : []);

  function selectDriver(id: string) {
    selectedDriverId = id;
    selectedZone = null;
  }

  function backToDrivers() {
    selectedDriverId = null;
    selectedZone = null;
  }

  function openZone(zone: BodyZone) {
    selectedZone = zone;
  }

  function closePanel() {
    selectedZone = null;
  }

  // Appelé après une attribution réussie : pulsation verte + fermeture du panneau.
  function onAssigned() {
    if (selectedZone) {
      pulseZone = selectedZone;
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => (pulseZone = null), 450);
    }
    selectedZone = null;
  }
</script>

<div class="mx-auto w-full max-w-5xl space-y-8 p-4 font-['Barlow_Condensed'] lg:p-10">
  <!-- En-tête -->
  <div class="flex items-center gap-4">
    <div class="rounded-2xl bg-green-600 p-3 shadow-lg">
      <ShieldCheck class="h-6 w-6 text-white" />
    </div>
    <div>
      <h1 class="text-3xl font-black tracking-tight text-green-800 uppercase">Attributions</h1>
      <p class="text-sm text-slate-400">Équipez chaque chauffeur, zone par zone</p>
    </div>
  </div>

  <!-- Deux vues : grille des chauffeurs, puis silhouette du chauffeur choisi -->
  {#if !selectedDriver}
    {#if data.drivers.length === 0}
      <div class="flex flex-col items-center gap-3 py-20 text-slate-400">
        <Users class="h-12 w-12 opacity-40" />
        <p class="text-sm font-medium">Aucun chauffeur enregistré.</p>
      </div>
    {:else}
      <DriverGrid drivers={data.drivers} onSelect={(d) => selectDriver(d.id)} />
    {/if}
  {:else}
    <BodySilhouette
      driver={selectedDriver}
      attributions={currentAttribution}
      onZoneClick={openZone}
      onBack={backToDrivers}
      {pulseZone}
    />
  {/if}
</div>

<!-- Panneau de sélection des EPI (feuille basse) -->
{#if selectedDriver && selectedZone}
  <button
    transition:fade={{ duration: 200 }}
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
    onclick={closePanel}
    aria-label="Fermer le panneau"
  ></button>
  <EpiPanel
    zone={selectedZone}
    driverId={selectedDriver.id}
    epiList={epiForZone}
    current={currentForZone}
    onClose={closePanel}
    {onAssigned}
  />
{/if}
