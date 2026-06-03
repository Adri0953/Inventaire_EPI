<script lang="ts">
  import type { PageData } from './$types';
  import {
    TriangleAlert,
    Package,
    Calendar,
    Users,
    Clock,
    TrendingDown,
    TrendingUp,
    History,
    ShieldCheck,
    Boxes,
    Wrench,
    UserCheck,
    PackagePlus,
    Activity,
  } from 'lucide-svelte';

  let { data }: { data: PageData } = $props();

  const { alerts, stats, activity } = $derived(data);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const relativeDate = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 7) return `Il y a ${days} j`;
    return formatDate(dateStr);
  };

  const daysUntil = (dateStr: string) =>
    Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);

  const totalAlerts = $derived(
    alerts.expiring.length + alerts.lowStock.length + alerts.controls.length,
  );

  const tauxAttribution = $derived(
    stats.total > 0 ? Math.round((stats.attribues / stats.total) * 100) : 0,
  );

  const tauxSansEquipement = $derived(
    stats.totalDrivers > 0
      ? Math.round((stats.driversWithoutEquipment / stats.totalDrivers) * 100)
      : 0,
  );
</script>

<div
  class="w-full max-w-7xl mx-auto p-4 lg:p-10 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700"
>
  <!-- ── ALERTES PRIORITAIRES ──────────────── -->
  <section class="space-y-6">
    <div
      class="flex items-center justify-between p-6 rounded-3xl shadow-xl border-b-4 transition-colors duration-500
			{totalAlerts > 0 ? 'bg-red-600 border-red-400' : 'bg-emerald-800 border-emerald-600'}"
    >
      <div class="flex items-center gap-4">
        <div
          class="p-3 backdrop-blur-md rounded-2xl border border-white/20 transition-colors duration-500
					{totalAlerts > 0 ? 'bg-red-400/30' : 'bg-emerald-600/40'}"
        >
          {#if totalAlerts > 0}
            <TriangleAlert class="w-6 h-6 text-white" />
          {:else}
            <ShieldCheck class="w-6 h-6 text-white" />
          {/if}
        </div>
        <div>
          <h2 class="text-2xl font-black text-white tracking-tight uppercase">Alertes</h2>
          <p
            class="text-xs font-bold uppercase tracking-widest mt-0.5 transition-colors duration-500
						{totalAlerts > 0 ? 'text-red-200' : 'text-emerald-200'}"
          >
            {totalAlerts > 0 ? "Points à traiter dans l'immédiat" : 'Aucune action requise'}
          </p>
        </div>
      </div>
      {#if totalAlerts > 0}
        <span
          class="px-5 py-2 bg-white/20 text-white text-sm font-black rounded-2xl shadow-lg animate-pulse border-2 border-white/30"
        >
          {totalAlerts} À TRAITER
        </span>
      {:else}
        <span
          class="px-5 py-2 bg-white/20 text-white text-sm font-black rounded-2xl shadow-lg border-2 border-white/30"
        >
          Tout est en règle
        </span>
      {/if}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Expirations -->
      <div
        class="group relative bg-white rounded-4xl shadow-xl hover:shadow-2xl transition-all duration-500 border-2 border-red-100 overflow-hidden flex flex-col h-160"
      >
        <div class="p-8 bg-linear-to-br from-red-600 to-red-500 relative overflow-hidden">
          <Clock class="absolute -right-4 -top-4 w-32 h-32 text-white/10 rotate-12" />
          <div class="relative z-10 flex items-center justify-between">
            <div class="flex flex-col">
              <h3 class="text-2xl font-black text-white tracking-tight">Expirations</h3>
            </div>
            <div class="bg-white/20 backdrop-blur-md rounded-2xl px-3 py-1 border border-white/30">
              <span class="text-sm font-black text-white tabular-nums"
                >{alerts.expiring.length}</span
              >
            </div>
          </div>
        </div>
        <div class="p-4 overflow-y-auto flex-1 space-y-3 bg-slate-50/30">
          {#if alerts.expiring.length > 0}
            {#each alerts.expiring as epi (epi.id_epi)}
              {@const days = daysUntil(epi.date_expiration)}
              <div
                class="flex items-center justify-between p-4 rounded-2xl bg-white border border-red-50 hover:border-red-200 transition-all shadow-sm"
              >
                <div class="min-w-0">
                  <p class="font-bold text-sm text-blue-950 truncate">{epi.nom}</p>
                  <p class="text-xs text-slate-400 flex items-center gap-1 mt-1 font-medium">
                    <Users class="w-3 h-3" />
                    {epi.chauffeur_nom || 'Non attribué'}
                  </p>
                </div>
                <div class="text-right shrink-0">
                  <p
                    class="text-[10px] font-bold text-slate-400 tabular-nums uppercase tracking-tighter"
                  >
                    {formatDate(epi.date_expiration)}
                  </p>
                  {#if days < 0}
                    <div
                      class="mt-1 px-2.5 py-0.5 bg-red-600 text-[9px] font-black text-white rounded-full shadow-lg shadow-red-200"
                    >
                      EXPIRÉ
                    </div>
                  {:else}
                    <span class="text-sm font-black {days <= 7 ? 'text-red-500' : 'text-slate-600'}"
                      >J-{days}</span
                    >
                  {/if}
                </div>
              </div>
            {/each}
          {:else}
            <div class="h-full flex flex-col items-center justify-center gap-3 opacity-30">
              <ShieldCheck class="w-12 h-12 text-slate-400" />
              <p class="text-xs font-black uppercase tracking-widest">Tout est en règle</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Maintenance -->
      <div
        class="group relative bg-white rounded-4xl shadow-xl hover:shadow-2xl transition-all duration-500 border-2 border-orange-100 overflow-hidden flex flex-col h-160"
      >
        <div class="p-8 bg-linear-to-br from-orange-500 to-orange-400 relative overflow-hidden">
          <Wrench class="absolute -right-4 -top-4 w-32 h-32 text-white/10 -rotate-12" />
          <div class="relative z-10 flex items-center justify-between">
            <div class="flex flex-col">
              <h3 class="text-2xl font-black text-white tracking-tight">Maintenance</h3>
            </div>
            <div class="bg-white/20 backdrop-blur-md rounded-2xl px-3 py-1 border border-white/30">
              <span class="text-sm font-black text-white tabular-nums"
                >{alerts.controls.length}</span
              >
            </div>
          </div>
        </div>
        <div class="p-4 overflow-y-auto flex-1 space-y-3 bg-slate-50/30">
          {#if alerts.controls.length > 0}
            {#each alerts.controls as ctrl (ctrl.id_controle)}
              {@const days = daysUntil(ctrl.prochain_controle)}
              <div
                class="flex items-center justify-between p-4 rounded-2xl bg-white border border-orange-50 hover:border-orange-200 transition-all shadow-sm"
              >
                <div class="min-w-0">
                  <p class="font-bold text-sm text-blue-950 truncate">
                    {ctrl.epi_nom || 'EPI inconnu'}
                  </p>
                  <p class="text-xs text-slate-400 flex items-center gap-1 mt-1 font-medium">
                    <Users class="w-3 h-3" />
                    {ctrl.chauffeur_nom || 'En stock'}
                  </p>
                </div>
                <div class="text-right shrink-0 font-black">
                  <p
                    class="text-[10px] font-bold text-slate-400 tabular-nums uppercase tracking-tighter"
                  >
                    {formatDate(ctrl.prochain_controle)}
                  </p>
                  {#if days < 0}
                    <div
                      class="mt-1 px-2.5 py-0.5 bg-red-600 text-[9px] font-black text-white rounded-full uppercase shadow-lg shadow-red-200"
                    >
                      Retard
                    </div>
                  {:else}
                    <span class="text-sm text-orange-600">J-{days}</span>
                  {/if}
                </div>
              </div>
            {/each}
          {:else}
            <div class="h-full flex flex-col items-center justify-center gap-3 opacity-30">
              <Calendar class="w-12 h-12 text-slate-400" />
              <p class="text-xs font-black uppercase tracking-widest">Planning à jour</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Stock Bas -->
      <div
        class="group relative bg-white rounded-4xl shadow-xl hover:shadow-2xl transition-all duration-500 border-2 border-amber-100 overflow-hidden flex flex-col md:col-span-2"
      >
        <div class="p-8 bg-linear-to-br from-amber-500 to-amber-400 relative overflow-hidden">
          <Boxes class="absolute -right-4 -top-4 w-32 h-32 text-white/10 rotate-45" />
          <div class="relative z-10 flex items-center justify-between">
            <div class="flex flex-col">
              <h3 class="text-2xl font-black text-white tracking-tight">Alertes des stocks</h3>
            </div>
          </div>
        </div>
        <div class="flex">
          <!-- Table -->
          <div class="flex-1 bg-white flex flex-col">
            {#if alerts.lowStock.length > 0}
              <div
                class="bg-white border-b border-slate-100 grid items-center gap-4 px-5 py-2.5"
                style="grid-template-columns: 72px 1fr 110px 90px 120px"
              >
                <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Niveau</p>
                <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Désignation
                </p>
                <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Catégorie
                </p>
                <p
                  class="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right"
                >
                  Stock restant
                </p>
                <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  / Seuil
                </p>
              </div>
              {#each alerts.lowStock as epi (epi.id_modele_epi)}
                {@const pct =
                  epi.seuil_alerte > 0
                    ? Math.min(Math.round((epi.stock_total / epi.seuil_alerte) * 100), 100)
                    : 0}
                {@const severity =
                  epi.stock_total === 0 ? 'rupture' : pct <= 40 ? 'critique' : 'bas'}
                <div
                  class="grid items-center gap-4 px-5 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  style="grid-template-columns: 72px 1fr 110px 90px 120px"
                >
                  {#if severity === 'rupture'}
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 border border-red-300 text-[9px] font-black text-red-800 uppercase w-fit"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>Rupture
                    </span>
                  {:else if severity === 'critique'}
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[9px] font-black text-red-600 uppercase w-fit"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>Critique
                    </span>
                  {:else}
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[9px] font-black text-amber-700 uppercase w-fit"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>Bas
                    </span>
                  {/if}
                  <p class="font-bold text-xs text-slate-800 truncate">{epi.designation}</p>
                  <span
                    class="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg w-fit truncate"
                    >{epi.type || '—'}</span
                  >
                  <p
                    class="text-xs font-black tabular-nums text-right
										{severity === 'rupture'
                      ? 'text-red-700'
                      : severity === 'critique'
                        ? 'text-red-500'
                        : 'text-amber-600'}"
                  >
                    {epi.stock_total} / {epi.seuil_alerte}
                  </p>
                  <div
                    class="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200"
                  >
                    <div
                      class="h-full rounded-full transition-all duration-700
											{severity === 'rupture' ? 'bg-slate-300' : severity === 'critique' ? 'bg-red-500' : 'bg-amber-400'}"
                      style="width: {pct}%"
                    ></div>
                  </div>
                </div>
              {/each}
            {:else}
              <div class="flex flex-col items-center justify-center gap-3 py-10 opacity-30">
                <PackagePlus class="w-12 h-12 text-slate-400" />
                <p class="text-xs font-black uppercase tracking-widest">Niveaux optimaux</p>
              </div>
            {/if}
          </div>

          <!-- Donut — répartition par sévérité -->
          {#if alerts.lowStock.length > 0}
            {@const total = alerts.lowStock.length}
            {@const nbRuptures = alerts.lowStock.filter((e) => e.stock_total === 0).length}
            {@const nbCritiques = alerts.lowStock.filter(
              (e) => e.stock_total > 0 && e.stock_total / e.seuil_alerte <= 0.4,
            ).length}
            {@const nbBas = total - nbRuptures - nbCritiques}
            {@const C = 2 * Math.PI * 40}
            {@const dashR = (nbRuptures / total) * C}
            {@const dashC = (nbCritiques / total) * C}
            {@const dashB = (nbBas / total) * C}
            <div
              class="w-52 shrink-0 border-l-2 border-amber-100 bg-amber-50/40 flex flex-col items-center justify-center gap-5 p-6"
            >
              <div class="relative">
                <svg
                  width="120"
                  height="120"
                  viewBox="0 0 120 120"
                  style="transform: rotate(-90deg)"
                >
                  <circle cx="60" cy="60" r="40" fill="none" stroke="#f1f5f9" stroke-width="16"
                  ></circle>
                  {#if nbRuptures > 0}
                    <circle
                      cx="60"
                      cy="60"
                      r="40"
                      fill="none"
                      stroke="#dc2626"
                      stroke-width="16"
                      stroke-dasharray="{dashR} {C}"
                      stroke-dashoffset="0"
                    ></circle>
                  {/if}
                  {#if nbCritiques > 0}
                    <circle
                      cx="60"
                      cy="60"
                      r="40"
                      fill="none"
                      stroke="#f87171"
                      stroke-width="16"
                      stroke-dasharray="{dashC} {C}"
                      stroke-dashoffset={-dashR}
                    ></circle>
                  {/if}
                  {#if nbBas > 0}
                    <circle
                      cx="60"
                      cy="60"
                      r="40"
                      fill="none"
                      stroke="#fbbf24"
                      stroke-width="16"
                      stroke-dasharray="{dashB} {C}"
                      stroke-dashoffset={-(dashR + dashC)}
                    ></circle>
                  {/if}
                </svg>
                <div
                  class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                >
                  <span class="text-2xl font-black text-slate-800 tabular-nums">{total}</span>
                  <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest"
                    >alertes</span
                  >
                </div>
              </div>
              <div class="flex flex-col gap-2 w-full">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-sm bg-red-600 shrink-0"></span>
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                      >Rupture</span
                    >
                  </div>
                  <span class="text-sm font-black text-slate-800">{nbRuptures}</span>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-sm bg-red-400 shrink-0"></span>
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                      >Critique</span
                    >
                  </div>
                  <span class="text-sm font-black text-slate-800">{nbCritiques}</span>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-sm bg-amber-400 shrink-0"></span>
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                      >Bas</span
                    >
                  </div>
                  <span class="text-sm font-black text-slate-800">{nbBas}</span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>

  <!-- ── CHIFFRES CLÉS ──────────────── -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <!-- Inventaire total -->
    <div
      class="lg:col-span-2 relative rounded-3xl p-6 overflow-hidden shadow-2xl border-2 border-blue-900 flex flex-col justify-between"
      style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)"
    >
      <Package class="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 opacity-10" />
      <div class="relative z-10">
        <p class="text-blue-300 font-black uppercase tracking-widest text-[10px]">
          Inventaire Total
        </p>
        <h3 class="text-5xl font-black text-white mt-1 tabular-nums leading-none tracking-tighter">
          {stats.total}
        </h3>
      </div>
      <div class="relative z-10 flex gap-2 mt-4 flex-wrap">
        <div
          class="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-sm"
        >
          <div
            class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
          ></div>
          <span class="text-xs font-black text-white">{stats.disponibles} LIBRES</span>
        </div>
        <div
          class="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-sm"
        >
          <div class="w-2 h-2 rounded-full bg-amber-400"></div>
          <span class="text-xs font-black text-white">{stats.attribues} EN SERVICE</span>
        </div>
        <div
          class="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-sm"
        >
          <div class="w-2 h-2 rounded-full bg-red-400"></div>
          <span class="text-xs font-black text-white">{stats.horsService} HORS SERVICE</span>
        </div>
      </div>
    </div>

    <!-- Taux d'attribution -->
    <div
      class="relative rounded-3xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden border-2 border-indigo-900"
      style="background: linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)"
    >
      <Activity class="absolute -right-3 -top-3 w-24 h-24 text-white/5" />
      <div class="relative z-10">
        <p class="text-indigo-300 font-black uppercase tracking-widest text-[10px]">Équipements</p>
        <div class="flex items-end gap-1 mt-1">
          <span class="text-5xl font-black text-white tabular-nums leading-none tracking-tighter"
            >{tauxAttribution}</span
          >
          <span class="text-2xl font-black text-indigo-300 mb-0.5">%</span>
        </div>
        <p class="text-indigo-200 text-xs font-bold uppercase tracking-widest mt-1">
          Taux d'attribution
        </p>
      </div>
      <div class="relative z-10 mt-4">
        <div class="h-2 bg-white/10 rounded-full overflow-hidden border border-white/10">
          <div
            class="h-full rounded-full bg-white/70 transition-all duration-700 shadow-[0_0_8px_rgba(255,255,255,0.3)]"
            style="width: {tauxAttribution}%"
          ></div>
        </div>
        <div class="flex justify-between mt-1.5">
          <span class="text-[10px] text-indigo-300 font-bold">{stats.attribues} attribués</span>
          <span class="text-[10px] text-indigo-300 font-bold">{stats.total} total</span>
        </div>
      </div>
    </div>

    <!-- Chauffeurs sans EPI -->
    <div
      class="relative rounded-3xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden border-2 transition-colors duration-500
			{stats.driversWithoutEquipment > 0 ? 'border-orange-800' : 'border-emerald-800'}"
      style={stats.driversWithoutEquipment > 0
        ? 'background: linear-gradient(135deg, #9a3412 0%, #ea580c 100%)'
        : 'background: linear-gradient(135deg, #065f46 0%, #059669 100%)'}
    >
      <Users class="absolute -right-3 -top-3 w-24 h-24 text-white/5" />
      <div class="relative z-10">
        <p
          class="font-black uppercase tracking-widest text-[10px] transition-colors duration-500
					{stats.driversWithoutEquipment > 0 ? 'text-orange-200' : 'text-emerald-200'}"
        >
          Chauffeurs
        </p>
        <div class="flex items-end gap-1 mt-1">
          <span class="text-5xl font-black text-white tabular-nums leading-none tracking-tighter"
            >{stats.driversWithoutEquipment}</span
          >
        </div>
        <p class="text-xs font-bold uppercase tracking-widest mt-1 text-white/70">
          Sans équipement
        </p>
      </div>
      <div class="relative z-10 mt-4">
        <div class="h-2 bg-white/10 rounded-full overflow-hidden border border-white/10">
          <div
            class="h-full rounded-full bg-white/70 transition-all duration-700 shadow-[0_0_8px_rgba(255,255,255,0.3)]"
            style="width: {tauxSansEquipement}%"
          ></div>
        </div>
        <div class="flex justify-between mt-1.5">
          <span class="text-[10px] font-bold text-white/60">
            {stats.driversWithoutEquipment > 0 ? 'À équiper' : 'Tous équipés ✓'}
          </span>
          <span class="text-[10px] font-bold text-white/60"
            >{stats.totalDrivers} chauffeur{stats.totalDrivers > 1 ? 's' : ''}</span
          >
        </div>
      </div>
    </div>
  </div>

  <!-- ── DERNIERES ACTIVITÉS ──────────────── -->
  <section class="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-12">
    <!-- Attributions récentes -->
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="px-8 py-6 bg-white border-b border-slate-100 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UserCheck class="w-5 h-5 text-blue-500" />
          <h3 class="font-bold text-slate-800">Attributions Récentes</h3>
        </div>
        <button
          class="text-[10px] font-black text-slate-400 uppercase hover:text-slate-900 transition-colors"
          >Voir tout</button
        >
      </div>
      <div class="divide-y divide-slate-50">
        {#each activity.assignments as item (item.id_attribution)}
          <div class="px-8 py-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
            <div
              class="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center font-black text-blue-700 text-sm"
            >
              {item.chauffeur_nom?.[0]?.toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-slate-900 truncate">{item.epi_nom}</p>
              <p class="text-xs text-slate-500 mt-0.5">{item.chauffeur_nom}</p>
            </div>
            <span class="text-xs font-bold text-blue-400 tabular-nums whitespace-nowrap"
              >{relativeDate(item.date_attribution)}</span
            >
          </div>
        {/each}
      </div>
    </div>

    <!-- Flux inventaire -->
    <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="px-8 py-6 bg-white border-b border-slate-100 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <History class="w-5 h-5 text-slate-400" />
          <h3 class="font-bold text-slate-800">Flux Inventaire</h3>
        </div>
        <button
          class="text-[10px] font-black text-slate-400 uppercase hover:text-slate-900 transition-colors"
          >Voir tout</button
        >
      </div>
      <div class="divide-y divide-slate-50">
        {#each activity.movements as item (item.id_historique)}
          {@const variation = item.nouvelle_valeur - item.ancienne_valeur}
          <div class="px-8 py-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
            <div
              class="w-10 h-10 rounded-2xl flex items-center justify-center
							{variation > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}"
            >
              {#if variation > 0}
                <TrendingUp class="w-5 h-5" />
              {:else}
                <TrendingDown class="w-5 h-5" />
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-slate-900 truncate">{item.epi_nom}</p>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">
                {item.motif || 'Mouvement de stock'} ·
                <span class={variation > 0 ? 'text-emerald-500' : 'text-red-400'}
                  >{relativeDate(item.date_modification)}</span
                >
              </p>
            </div>
            <span
              class="font-black text-sm shrink-0 {variation > 0
                ? 'text-emerald-600'
                : 'text-red-500'}"
            >
              {variation > 0 ? '+' : ''}{variation}
            </span>
          </div>
        {/each}
      </div>
    </div>
  </section>
</div>
