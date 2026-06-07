<script lang="ts">
  import type { Driver } from '$lib/types/attributions';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { UserRound } from 'lucide-svelte';

  // Composant feuille : reçoit la liste et remonte la sélection via callback.
  let { drivers, onSelect }: { drivers: Driver[]; onSelect: (d: Driver) => void } = $props();

  // Mémorise le chauffeur cliqué pour différencier les animations de sortie :
  // le sélectionné s'envole vers le haut, les autres sur les côtés.
  let selectedId = $state<string | null>(null);

  function choose(driver: Driver) {
    selectedId = driver.id;
    onSelect(driver);
  }

  function outParams(driver: Driver, index: number) {
    if (driver.id === selectedId) return { y: -60, duration: 300 };
    return { x: index % 2 === 0 ? -600 : 600, delay: index * 50, duration: 400 };
  }
</script>

<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
  {#each drivers as driver, index (driver.id)}
    <button
      type="button"
      onclick={() => choose(driver)}
      in:fly={{ y: 40, delay: index * 80, duration: 350, easing: quintOut }}
      out:fly={outParams(driver, index)}
      class="group flex flex-col items-center gap-4 rounded-3xl border-2 border-transparent bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-green-500 hover:shadow-lg"
    >
      <div
        class="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-800 ring-4 ring-green-50 transition-colors group-hover:bg-green-500 group-hover:text-white"
      >
        {driver.initials}
      </div>
      <div class="text-center">
        <p class="font-semibold text-slate-800">{driver.name}</p>
        {#if driver.activite}
          <p class="mt-0.5 truncate text-xs text-slate-400">{driver.activite}</p>
        {/if}
        <p
          class="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-green-600 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <UserRound class="h-3 w-3" />
          Équiper
        </p>
      </div>
    </button>
  {/each}
</div>
