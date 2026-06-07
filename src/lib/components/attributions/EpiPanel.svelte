<script lang="ts">
  import type { AssignedEpi, BodyZone, EpiItem } from '$lib/types/attributions';
  import { ZONE_LABELS } from '$lib/types/attributions';
  import { enhance } from '$app/forms';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import {
    HardHat,
    Glasses,
    Shirt,
    Hand,
    PersonStanding,
    Footprints,
    X,
    Check,
    UserMinus,
  } from 'lucide-svelte';

  // Composant feuille : présente le catalogue d'une zone (issu de la BD) et
  // déclenche les actions serveur. La logique de données vit côté serveur.
  let {
    zone,
    driverId,
    epiList,
    current,
    onClose,
    onAssigned,
  }: {
    zone: BodyZone;
    driverId: string;
    epiList: EpiItem[];
    current: AssignedEpi[];
    onClose: () => void;
    onAssigned: () => void;
  } = $props();

  // Icône Lucide adaptée à chaque zone corporelle.
  const ZONE_ICONS: Record<BodyZone, typeof HardHat> = {
    head: HardHat,
    eyes: Glasses,
    torso: Shirt,
    hands: Hand,
    legs: PersonStanding,
    feet: Footprints,
  };

  const ZoneIcon = $derived(ZONE_ICONS[zone]);

  // Couleur du badge de stock : vert au-dessus du seuil, ambre sous le seuil, rouge en rupture.
  function badgeClass(item: EpiItem): string {
    if (item.stock === 0) return 'bg-red-100 text-red-600';
    if (item.stock <= item.seuil) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  }
</script>

<section
  in:fly={{ y: 400, duration: 350, easing: quintOut }}
  out:fly={{ y: 400, duration: 250 }}
  class="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[78vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl"
  aria-label={ZONE_LABELS[zone]}
>
  <!-- En-tête du panneau -->
  <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
    <div class="flex items-center gap-3">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700"
      >
        <ZoneIcon class="h-5 w-5" />
      </div>
      <div>
        <h3 class="text-lg font-bold text-slate-800">{ZONE_LABELS[zone]}</h3>
        <p class="text-xs font-medium text-slate-400">
          {epiList.length} produit{epiList.length > 1 ? 's' : ''} au catalogue
        </p>
      </div>
    </div>
    <button
      type="button"
      onclick={onClose}
      class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      aria-label="Fermer"
    >
      <X class="h-5 w-5" />
    </button>
  </div>

  <div class="overflow-y-auto p-5">
    <!-- EPI déjà attribués sur cette zone -->
    {#if current.length > 0}
      <div class="mb-5 space-y-2">
        <p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Déjà attribué</p>
        {#each current as assigned (assigned.idAttribution)}
          <div class="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
            >
              <Check class="h-4 w-4" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-slate-800">
                {assigned.name}{assigned.taille ? ` · ${assigned.taille}` : ''}
              </p>
              <p class="truncate text-xs text-slate-500">{assigned.type}</p>
            </div>
            <form
              method="POST"
              action="?/retirer"
              use:enhance={() =>
                async ({ update }) => {
                  await update();
                }}
            >
              <input type="hidden" name="id_attribution" value={assigned.idAttribution} />
              <input type="hidden" name="id_epi" value={assigned.idEpi} />
              <button
                type="submit"
                class="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                <UserMinus class="h-3.5 w-3.5" />
                Retirer
              </button>
            </form>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Catalogue disponible pour la zone -->
    {#if epiList.length === 0}
      <div class="flex flex-col items-center gap-2 py-10 text-slate-400">
        <ZoneIcon class="h-10 w-10 opacity-40" />
        <p class="text-sm font-medium">Aucun équipement pour cette zone.</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each epiList as item (item.id)}
          <div
            class="rounded-xl border-l-4 bg-white p-4 shadow-sm
              {item.stock === 0 ? 'border-slate-200 opacity-70' : 'border-green-500'}"
          >
            <div class="flex items-start gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600"
              >
                <ZoneIcon class="h-4 w-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-slate-800">{item.name}</p>
                <p class="mt-0.5 text-xs text-slate-400">{item.type}</p>
              </div>
              <span
                class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold {badgeClass(item)}"
              >
                {item.stock === 0 ? 'Rupture' : `${item.stock} dispo.`}
              </span>
            </div>

            <!-- Tailles disponibles : un bouton = attribution d'une unité de cette taille -->
            <div class="mt-3 flex flex-wrap gap-2">
              {#each item.options as opt (opt.taille ?? '__std__')}
                <form
                  method="POST"
                  action="?/attribuer"
                  use:enhance={() =>
                    async ({ update }) => {
                      await update();
                      onAssigned();
                    }}
                >
                  <input type="hidden" name="id_chauffeur" value={driverId} />
                  <input type="hidden" name="id_epi" value={opt.idEpi ?? ''} />
                  <button
                    type="submit"
                    disabled={!opt.idEpi}
                    class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors
                      {opt.idEpi
                      ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                      : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'}"
                  >
                    {opt.taille ?? 'Standard'}
                    <span class="text-[10px] opacity-70">({opt.available})</span>
                  </button>
                </form>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>
