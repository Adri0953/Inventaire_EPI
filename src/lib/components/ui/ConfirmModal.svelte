<script lang="ts">
  import { confirmStore } from '$lib/stores/confirm';
  import { fly, fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { TriangleAlert, CircleCheck, X } from 'lucide-svelte';
</script>

{#if $confirmStore}
  {@const { options } = $confirmStore}
  <div
    transition:fade={{ duration: 200 }}
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
  >
    <div
      in:fly={{ y: 20, duration: 280, easing: quintOut }}
      class="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
    >
      <div class="mb-5 flex items-start gap-4">
        <div
          class="shrink-0 rounded-xl p-2.5 {options.confirmVariant === 'success'
            ? 'bg-emerald-100'
            : 'bg-red-100'}"
        >
          {#if options.confirmVariant === 'success'}
            <CircleCheck class="h-5 w-5 text-emerald-600" />
          {:else}
            <TriangleAlert class="h-5 w-5 text-red-600" />
          {/if}
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-black text-slate-900">{options.title}</h3>
          <p class="mt-1 text-sm leading-relaxed text-slate-500">{options.message}</p>
        </div>
        <button
          type="button"
          onclick={() => confirmStore.respond(false)}
          class="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          onclick={() => confirmStore.respond(false)}
          class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onclick={() => confirmStore.respond(true)}
          class="rounded-xl px-4 py-2 text-sm font-bold transition-colors {options.confirmVariant ===
          'success'
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'bg-red-600 text-white hover:bg-red-700'}"
        >
          {options.confirmLabel ?? 'Confirmer'}
        </button>
      </div>
    </div>
  </div>
{/if}
