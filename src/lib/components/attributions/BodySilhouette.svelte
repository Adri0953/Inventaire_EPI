<script lang="ts">
  import type { Attribution, BodyZone, Driver } from '$lib/types/attributions';
  import { BODY_ZONES, ZONE_LABELS } from '$lib/types/attributions';
  import { fly, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { ArrowLeft, Check } from 'lucide-svelte';

  // Composant feuille : aucune logique métier, tout remonte via callbacks.
  let {
    driver,
    attributions,
    onZoneClick,
    onBack,
    pulseZone = null,
  }: {
    driver: Driver;
    attributions: Attribution;
    onZoneClick: (zone: BodyZone) => void;
    onBack: () => void;
    pulseZone?: BodyZone | null;
  } = $props();

  // Position(s) du marqueur de validation par zone, dans le repère du viewBox.
  const CHECK_POS: Record<BodyZone, { x: number; y: number }[]> = {
    head: [{ x: 100, y: 33 }],
    eyes: [{ x: 100, y: 46 }],
    torso: [{ x: 100, y: 150 }],
    hands: [
      { x: 58, y: 214 },
      { x: 142, y: 214 },
    ],
    legs: [
      { x: 88, y: 312 },
      { x: 112, y: 312 },
    ],
    feet: [
      { x: 83, y: 416 },
      { x: 117, y: 416 },
    ],
  };

  const isAttributed = (zone: BodyZone) => (attributions[zone]?.length ?? 0) > 0;

  function handleKey(event: KeyboardEvent, zone: BodyZone) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onZoneClick(zone);
    }
  }
</script>

<div in:fly={{ y: 50, duration: 400 }} class="flex flex-col items-center gap-6">
  <!-- En-tête : retour + identité du chauffeur -->
  <div class="flex w-full items-center gap-3">
    <button
      type="button"
      onclick={onBack}
      class="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
    >
      <ArrowLeft class="h-4 w-4" />
      Retour
    </button>

    <div in:fly={{ x: -20, duration: 250 }} class="flex items-center gap-3">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-white"
      >
        {driver.initials}
      </div>
      <div>
        <p class="text-xs font-medium tracking-wide text-slate-400 uppercase">Équipement de</p>
        <h2 class="text-lg font-bold text-slate-800">{driver.name}</h2>
      </div>
    </div>
  </div>

  <!-- Silhouette interactive -->
  <svg
    viewBox="0 0 200 470"
    class="w-44 max-w-full select-none"
    role="group"
    aria-label="Silhouette corporelle — cliquez une zone pour attribuer un EPI"
  >
    <!-- Parties non interactives (cou, bras) -->
    <rect class="static-part" x="91" y="68" width="18" height="18" rx="3"></rect>
    <rect class="static-part" x="50" y="102" width="16" height="104" rx="8"></rect>
    <rect class="static-part" x="134" y="102" width="16" height="104" rx="8"></rect>

    <!-- Tête -->
    <g
      class="zone"
      class:attributed={isAttributed('head')}
      class:pulse={pulseZone === 'head'}
      role="button"
      tabindex="0"
      aria-label={`${ZONE_LABELS.head} — ${isAttributed('head') ? 'attribué' : 'libre'}`}
      onclick={() => onZoneClick('head')}
      onkeydown={(e) => handleKey(e, 'head')}
    >
      <circle cx="100" cy="46" r="28"></circle>
    </g>

    <!-- Yeux (visière) -->
    <g
      class="zone"
      class:attributed={isAttributed('eyes')}
      class:pulse={pulseZone === 'eyes'}
      role="button"
      tabindex="0"
      aria-label={`${ZONE_LABELS.eyes} — ${isAttributed('eyes') ? 'attribué' : 'libre'}`}
      onclick={() => onZoneClick('eyes')}
      onkeydown={(e) => handleKey(e, 'eyes')}
    >
      <rect x="77" y="40" width="46" height="13" rx="6"></rect>
    </g>

    <!-- Torse -->
    <g
      class="zone"
      class:attributed={isAttributed('torso')}
      class:pulse={pulseZone === 'torso'}
      role="button"
      tabindex="0"
      aria-label={`${ZONE_LABELS.torso} — ${isAttributed('torso') ? 'attribué' : 'libre'}`}
      onclick={() => onZoneClick('torso')}
      onkeydown={(e) => handleKey(e, 'torso')}
    >
      <path d="M 68 102 Q 70 86 100 86 Q 130 86 132 102 L 128 164 L 124 224 L 76 224 L 72 164 Z"
      ></path>
    </g>

    <!-- Mains -->
    <g
      class="zone"
      class:attributed={isAttributed('hands')}
      class:pulse={pulseZone === 'hands'}
      role="button"
      tabindex="0"
      aria-label={`${ZONE_LABELS.hands} — ${isAttributed('hands') ? 'attribué' : 'libre'}`}
      onclick={() => onZoneClick('hands')}
      onkeydown={(e) => handleKey(e, 'hands')}
    >
      <circle cx="58" cy="214" r="13"></circle>
      <circle cx="142" cy="214" r="13"></circle>
    </g>

    <!-- Jambes -->
    <g
      class="zone"
      class:attributed={isAttributed('legs')}
      class:pulse={pulseZone === 'legs'}
      role="button"
      tabindex="0"
      aria-label={`${ZONE_LABELS.legs} — ${isAttributed('legs') ? 'attribué' : 'libre'}`}
      onclick={() => onZoneClick('legs')}
      onkeydown={(e) => handleKey(e, 'legs')}
    >
      <rect x="78" y="224" width="20" height="182" rx="10"></rect>
      <rect x="102" y="224" width="20" height="182" rx="10"></rect>
    </g>

    <!-- Pieds -->
    <g
      class="zone"
      class:attributed={isAttributed('feet')}
      class:pulse={pulseZone === 'feet'}
      role="button"
      tabindex="0"
      aria-label={`${ZONE_LABELS.feet} — ${isAttributed('feet') ? 'attribué' : 'libre'}`}
      onclick={() => onZoneClick('feet')}
      onkeydown={(e) => handleKey(e, 'feet')}
    >
      <rect x="66" y="406" width="34" height="20" rx="9"></rect>
      <rect x="100" y="406" width="34" height="20" rx="9"></rect>
    </g>

    <!-- Marqueurs de validation (icône Lucide via foreignObject) -->
    {#each BODY_ZONES as zone (zone)}
      {#if isAttributed(zone)}
        {#each CHECK_POS[zone] as pos, i (i)}
          <foreignObject x={pos.x - 9} y={pos.y - 9} width="18" height="18" class="check">
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              in:scale={{ start: 0, duration: 300, easing: backOut }}
              class="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-green-700 text-white shadow"
            >
              <Check class="h-3 w-3" strokeWidth={3} />
            </div>
          </foreignObject>
        {/each}
      {/if}
    {/each}
  </svg>

  <p class="text-sm text-slate-400">Cliquez une zone du corps pour attribuer un équipement.</p>
</div>

<style>
  .static-part {
    fill: #f1f8f1;
    stroke: #cfe8d0;
    stroke-width: 1.5;
  }

  .zone {
    fill: #ffffff;
    stroke: #4caf50;
    stroke-width: 1.5;
    cursor: pointer;
    outline: none;
    transition:
      fill 200ms ease,
      stroke-width 200ms ease,
      filter 200ms ease;
    /* Le scale de la pulsation s'effectue autour du centre de chaque zone. */
    transform-box: fill-box;
    transform-origin: center;
  }

  .zone:hover,
  .zone:focus-visible {
    stroke-width: 3;
    filter: drop-shadow(0 0 6px #4caf50);
  }

  .zone.attributed {
    fill: #81c784;
  }

  .zone.pulse {
    animation: pulse-green 400ms ease;
  }

  /* Le marqueur ne doit pas intercepter les clics destinés à la zone. */
  .check {
    pointer-events: none;
    overflow: visible;
  }

  @keyframes pulse-green {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }
</style>
