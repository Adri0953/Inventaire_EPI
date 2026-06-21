<script lang="ts">
  import { Loader2 } from 'lucide-svelte';

  let { hasMore, onLoadMore }: { hasMore: boolean; onLoadMore: () => void } = $props();

  let el: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  });
</script>

<div bind:this={el}>
  {#if hasMore}
    <div class="flex items-center justify-center gap-2 py-8 text-slate-400">
      <Loader2 class="w-5 h-5 animate-spin" />
      <span class="text-xs font-semibold">Chargement…</span>
    </div>
  {/if}
</div>
