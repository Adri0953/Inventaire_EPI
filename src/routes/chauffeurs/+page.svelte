<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
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
		ChevronRight,
		Save,
		Clock,
		Wrench,
		UserPlus,
		ChevronsUpDown,
		ChevronUp,
		ChevronDown,
		Ellipsis,
	} from 'lucide-svelte';
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

	type SortCol = 'nom' | 'activite' | 'epis' | 'statut' | 'expiration';
	let sortCol = $state<SortCol>('nom');
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
		transferAllTarget = '';
		epiTransferTargets = {};
		epiTransferOpen = {};
		epiMenuOpen = {};
	}

	// ── Mode édition ──────────────────────────────────────────────────────
	let editMode = $state(false);
	let editPrenom = $state('');
	let editNom = $state('');
	let editActivite = $state('');

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

	const groupedEpis = $derived.by(() => {
		if (!selectedDriver) return { expired: [], control: [], rest: [] };
		const expired = selectedDriver.epis.filter(
			(e) => e.date_expiration && daysUntil(e.date_expiration) < 0,
		);
		const expiredIds = new Set(expired.map((e) => e.id_attribution));
		const control = selectedDriver.epis.filter(
			(e) => !expiredIds.has(e.id_attribution) && e.prochain_controle && daysUntil(e.prochain_controle) < 0,
		);
		const controlIds = new Set(control.map((e) => e.id_attribution));
		const rest = selectedDriver.epis
			.filter((e) => !expiredIds.has(e.id_attribution) && !controlIds.has(e.id_attribution))
			.sort((a, b) => {
				const aMin = Math.min(
					a.date_expiration ? daysUntil(a.date_expiration) : Infinity,
					a.prochain_controle ? daysUntil(a.prochain_controle) : Infinity,
				);
				const bMin = Math.min(
					b.date_expiration ? daysUntil(b.date_expiration) : Infinity,
					b.prochain_controle ? daysUntil(b.prochain_controle) : Infinity,
				);
				return aMin - bMin;
			});
		return { expired, control, rest };
	});
</script>

<!-- ── PAGE ──────────────────────────────────────────────────────────────── -->
<div
	class="w-full max-w-7xl mx-auto p-4 lg:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700"
>
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<div class="p-3 rounded-2xl bg-blue-950 shadow-lg">
				<Users class="w-6 h-6 text-white" />
			</div>
			<div>
				<h1 class="text-3xl font-black text-blue-950 tracking-tight uppercase">Chauffeurs</h1>
				<p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
					{stats.total} chauffeur{stats.total > 1 ? 's' : ''} enregistré{stats.total > 1
						? 's'
						: ''}
				</p>
			</div>
		</div>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href="/chauffeurs/nouveau" class="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-950 text-white text-sm font-black hover:bg-blue-800 transition-colors shadow-lg"
		>
			<UserPlus class="w-4 h-4" />
			Nouveau chauffeur
		</a>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<div
			class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 border-blue-400 flex items-center gap-4"
			style="background: linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)"
		>
			<Users class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
			<span class="text-4xl font-black text-white tabular-nums leading-none shrink-0">{stats.total}</span>
			<p class="text-blue-100 text-sm font-bold leading-snug">Chauffeurs au total</p>
		</div>

		<button
			onclick={() => (filterStatus = filterStatus === 'complet' ? '' : 'complet')}
			class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 text-left transition-all flex items-center gap-4
				{filterStatus === 'complet'
				? 'border-emerald-300 ring-2 ring-emerald-300'
				: 'border-emerald-400'}"
			style="background: linear-gradient(135deg, #059669 0%, #34d399 100%)"
		>
			<ShieldCheck class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
			<span class="text-4xl font-black text-white tabular-nums leading-none shrink-0">{stats.complets}</span>
			<p class="text-emerald-100 text-sm font-bold leading-snug">Bien équipés</p>
		</button>

		<button
			onclick={() => (filterStatus = filterStatus === 'incomplet' ? '' : 'incomplet')}
			class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 text-left transition-all flex items-center gap-4
				{filterStatus === 'incomplet'
				? 'border-amber-300 ring-2 ring-amber-300'
				: 'border-amber-400'}"
			style="background: linear-gradient(135deg, #d97706 0%, #fbbf24 100%)"
		>
			<ShieldAlert class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
			<span class="text-4xl font-black text-white tabular-nums leading-none shrink-0">{stats.incomplets}</span>
			<p class="text-amber-100 text-sm font-bold leading-snug">Partiellement équipés</p>
		</button>

		<button
			onclick={() => (filterStatus = filterStatus === 'non_equipe' ? '' : 'non_equipe')}
			class="relative rounded-3xl px-5 py-4 overflow-hidden shadow-xl border-2 text-left transition-all flex items-center gap-4
				{filterStatus === 'non_equipe'
				? 'border-red-300 ring-2 ring-red-300'
				: 'border-red-400'}"
			style="background: linear-gradient(135deg, #ef4444 0%, #f87171 100%)"
		>
			<ShieldX class="absolute -right-3 -bottom-3 w-20 h-20 text-white/10" />
			<span class="text-4xl font-black text-white tabular-nums leading-none shrink-0">{stats.nonEquipes}</span>
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
		{#if filterStatus}
			<button
				onclick={() => (filterStatus = '')}
				class="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-100 text-blue-700 text-sm font-bold hover:bg-blue-200 transition-colors"
			>
				<X class="w-3.5 h-3.5" />
				Effacer le filtre
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

			{@render sortBtn('nom', 'Nom / Prénom')}
			{@render sortBtn('activite', 'Activité', true)}
			{@render sortBtn('epis', 'EPI', true)}
			{@render sortBtn('statut', 'Statut', true)}
			{@render sortBtn('expiration', 'Alertes', true)}
			<p class="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Actions</p>
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
				class="cursor-pointer grid items-center gap-4 px-6 py-4 border-b border-slate-50 hover:bg-blue-50/40 transition-colors group"
				style="grid-template-columns: 1fr 160px 80px 110px 130px 130px"
			>
				<!-- Nom -->
				<div class="flex items-center gap-3 min-w-0">
					<div
						class="w-9 h-9 rounded-xl bg-blue-950 flex items-center justify-center font-black text-white text-sm shrink-0"
					>
						{c.nom[0]?.toUpperCase()}
					</div>
					<div class="min-w-0">
						<p class="font-bold text-sm text-slate-900 truncate">{c.nom} {c.prenom}</p>
					</div>
				</div>

				<!-- Activité -->
				<p class="text-xs text-slate-500 font-medium truncate text-center">{c.activite ?? '—'}</p>

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
							class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] font-black text-emerald-700 uppercase"
						>
							<ShieldCheck class="w-3 h-3" />Complet
						</span>
					{:else if status === 'incomplet'}
						<span
							class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-[10px] font-black text-amber-700 uppercase"
						>
							<ShieldAlert class="w-3 h-3" />Incomplet
						</span>
					{:else}
						<span
							class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-50 border border-red-200 text-[10px] font-black text-red-600 uppercase"
						>
							<ShieldX class="w-3 h-3" />Non équipé
						</span>
					{/if}
				</div>

				<!-- Alertes -->
				<div class="flex justify-center">
					{#if getAlertLevel(c) === 'red'}
						<TriangleAlert class="w-4 h-4 text-red-600" />
					{:else if getAlertLevel(c) === 'orange'}
						<TriangleAlert class="w-4 h-4 text-orange-400" />
					{:else}
						<span class="text-[10px] font-bold text-slate-300">—</span>
					{/if}
				</div>

				<!-- Actions rapides -->
				<div
					role="none"
					onclick={(e) => e.stopPropagation()}
					class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
				>
					<button
						onclick={() => openDriver(c.id_chauffeur)}
						class="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
						title="Voir la fiche"
					>
						<ChevronRight class="w-4 h-4" />
					</button>

					<form
						method="POST"
						action="?/supprimer"
						use:enhance={() => {
							if (!confirm(`Supprimer ${c.prenom} ${c.nom} ? Ses EPI seront libérés.`))
								return () => {};
							return ({ update }) => update();
						}}
					>
						<input type="hidden" name="id_chauffeur" value={c.id_chauffeur} />
						<button
							type="submit"
							class="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
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
		<div class="p-6 bg-linear-to-br from-blue-950 to-blue-800 relative overflow-hidden shrink-0">
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
				<div class="p-6 border-b border-slate-100 bg-blue-50/30">
					<h3 class="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
						Modifier les informations
					</h3>
					<form
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
						class="space-y-3"
					>
						<input type="hidden" name="id_chauffeur" value={selectedDriver.id_chauffeur} />
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label
									for="edit-prenom"
									class="text-[10px] font-black uppercase text-slate-400 block mb-1"
									>Prénom</label
								>
								<input
									id="edit-prenom"
									name="prenom"
									bind:value={editPrenom}
									required
									class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
								/>
							</div>
							<div>
								<label
									for="edit-nom"
									class="text-[10px] font-black uppercase text-slate-400 block mb-1"
									>Nom</label
								>
								<input
									id="edit-nom"
									name="nom"
									bind:value={editNom}
									required
									class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
								/>
							</div>
						</div>
						<div>
							<label
								for="edit-activite"
								class="text-[10px] font-black uppercase text-slate-400 block mb-1"
								>Activité</label
							>
							<select
								id="edit-activite"
								name="activite"
								bind:value={editActivite}
								class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
							>
								<option value="">— Non renseignée —</option>
								{#each ACTIVITES as a (a)}
									<option value={a}>{a}</option>
								{/each}
							</select>
						</div>
						<div class="flex gap-2 pt-1">
							<button
								type="submit"
								class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-950 text-white text-xs font-black hover:bg-blue-800 transition-colors"
							>
								<Save class="w-3.5 h-3.5" />Enregistrer
							</button>
							<button
								type="button"
								onclick={() => (editMode = false)}
								class="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black hover:bg-slate-200 transition-colors"
							>
								Annuler
							</button>
						</div>
					</form>
				</div>
			{/if}

			<!-- ── Liste des EPI ─────────────────────────────────────────── -->
			<div class="p-5 space-y-4">
				<p class="text-[10px] font-black uppercase tracking-widest text-slate-400">
					EPI attribués ({selectedDriver.epis.length})
				</p>

				{#if selectedDriver.epis.length === 0}
					<div class="flex flex-col items-center gap-2 py-8 opacity-30">
						<Package class="w-10 h-10 text-slate-400" />
						<p class="text-xs font-black uppercase tracking-widest">Aucun EPI attribué</p>
					</div>
				{:else}

					{#snippet epiCard(epi: (typeof selectedDriver.epis)[0])}
						{@const days = epi.date_expiration ? daysUntil(epi.date_expiration) : null}
						{@const controlDays = epi.prochain_controle ? daysUntil(epi.prochain_controle) : null}
						{@const expired = days !== null && days < 0}
						{@const expiringSoon = days !== null && days >= 0 && days <= 30}
						{@const controlOverdue = controlDays !== null && controlDays < 0}
						{@const controlSoon = controlDays !== null && controlDays >= 0 && controlDays <= 30}
						<div
							class="rounded-2xl border bg-white shadow-sm relative
								{expired ? 'border-red-200' : controlOverdue ? 'border-red-200' : (expiringSoon || controlSoon) ? 'border-orange-200' : 'border-slate-100'}"
						>
							<!-- Info EPI -->
							<div class="px-4 py-3 flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<p class="font-bold text-sm text-slate-900">{epi.designation}</p>
										{#if epi.taille}
											<span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{epi.taille}</span>
										{/if}
									</div>
									<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{epi.type}</p>
									<div class="flex items-center gap-3 mt-1.5 flex-wrap">
										{#if epi.date_expiration}
											<span class="flex items-center gap-1.5 text-[10px] font-bold {expired ? 'text-red-500' : expiringSoon ? 'text-orange-500' : 'text-slate-500'}">
												<Clock class="w-3 h-3" />Exp. {formatDate(epi.date_expiration)}
												{#if expiringSoon}
													<span class="text-[9px] font-black text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded-full">J-{days}</span>
												{/if}
											</span>
										{/if}
										{#if epi.prochain_controle}
											<span class="flex items-center gap-1.5 text-[10px] font-bold {controlOverdue ? 'text-red-500' : controlSoon ? 'text-amber-600' : 'text-slate-500'}">
												<Wrench class="w-3 h-3" />Contrôle {formatDate(epi.prochain_controle)}
												{#if controlSoon}
													<span class="text-[9px] font-black text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded-full">J-{controlDays}</span>
												{/if}
											</span>
										{/if}
									</div>
								</div>

								<!-- Menu ⋯ -->
								<div role="none" class="relative shrink-0" onclick={(e) => e.stopPropagation()}>
									<button
										type="button"
										onclick={() => toggleEpiMenu(epi.id_attribution)}
										class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
									>
										<Ellipsis class="w-4 h-4" />
									</button>

									{#if epiMenuOpen[epi.id_attribution]}
										<div class="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-10">
											<form method="POST" action="?/retirer_epi" use:enhance={({ cancel }) => {
												if (!confirm(`Retirer "${epi.designation}" de ce chauffeur ?`)) { cancel(); return; }
												return ({ update }) => { epiMenuOpen = {}; update(); };
											}}>
												<input type="hidden" name="id_attribution" value={epi.id_attribution} />
												<input type="hidden" name="id_epi" value={epi.id_epi} />
												<button type="submit" class="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors text-left">
													<X class="w-3.5 h-3.5" />Retirer
												</button>
											</form>
											<form method="POST" action="?/hors_service" use:enhance={({ cancel }) => {
												if (!confirm(`Marquer "${epi.designation}" comme hors service ?`)) { cancel(); return; }
												return ({ update }) => { epiMenuOpen = {}; update(); };
											}}>
												<input type="hidden" name="id_attribution" value={epi.id_attribution} />
												<input type="hidden" name="id_epi" value={epi.id_epi} />
												<button type="submit" class="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors text-left">
													<ShieldX class="w-3.5 h-3.5" />Hors service
												</button>
											</form>
											<button
												type="button"
												onclick={() => { toggleEpiTransfer(epi.id_attribution); epiMenuOpen = {}; }}
												class="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 transition-colors text-left"
											>
												<ArrowRightLeft class="w-3.5 h-3.5" />Transférer
											</button>
										</div>
									{/if}
								</div>
							</div>

							{#if epiTransferOpen[epi.id_attribution]}
								<div class="px-4 pb-4 bg-indigo-50/50 border-t border-indigo-100 rounded-b-2xl">
									<form method="POST" action="?/transferer_epi" use:enhance={({ cancel }) => {
										if (!epiTransferTargets[epi.id_attribution]) { cancel(); return; }
										return ({ update }) => {
											epiTransferOpen = { ...epiTransferOpen, [epi.id_attribution]: false };
											update();
										};
									}} class="flex gap-2 pt-3">
										<input type="hidden" name="id_attribution" value={epi.id_attribution} />
										<input type="hidden" name="id_epi" value={epi.id_epi} />
										<select name="id_chauffeur_dest" bind:value={epiTransferTargets[epi.id_attribution]}
											class="flex-1 px-3 py-2 rounded-xl border border-indigo-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
											<option value="">Choisir un chauffeur…</option>
											{#each otherDrivers as d (d.id_chauffeur)}
												<option value={d.id_chauffeur}>{d.nom} {d.prenom}</option>
											{/each}
										</select>
										<button type="submit" disabled={!epiTransferTargets[epi.id_attribution]}
											class="px-3 py-2 rounded-xl bg-indigo-700 text-white text-xs font-black hover:bg-indigo-600 transition-colors disabled:opacity-40 shrink-0">
											OK
										</button>
									</form>
								</div>
							{/if}
						</div>
					{/snippet}

					{#if groupedEpis.expired.length > 0}
						<div class="flex items-center gap-1.5">
							<TriangleAlert class="w-4 h-4 text-red-500 shrink-0" />
							<p class="text-xs font-black uppercase tracking-widest text-red-500">EPI expirés</p>
						</div>
						<div class="space-y-2">
							{#each groupedEpis.expired as epi (epi.id_attribution)}
								{@render epiCard(epi)}
							{/each}
						</div>
					{/if}

					{#if groupedEpis.control.length > 0}
						<div class="flex items-center gap-1.5 {groupedEpis.expired.length > 0 ? 'pt-2' : ''}">
							<Wrench class="w-4 h-4 text-amber-500 shrink-0" />
							<p class="text-xs font-black uppercase tracking-widest text-amber-500">Contrôle requis</p>
						</div>
						<div class="space-y-2">
							{#each groupedEpis.control as epi (epi.id_attribution)}
								{@render epiCard(epi)}
							{/each}
						</div>
					{/if}

					{#if groupedEpis.rest.length > 0}
						{#if groupedEpis.expired.length > 0 || groupedEpis.control.length > 0}
							<div class="flex items-center gap-1.5 pt-2">
								<ShieldCheck class="w-4 h-4 text-emerald-500 shrink-0" />
								<p class="text-xs font-black uppercase tracking-widest text-emerald-500">En ordre</p>
							</div>
						{/if}
						<div class="space-y-2">
							{#each groupedEpis.rest as epi (epi.id_attribution)}
								{@render epiCard(epi)}
							{/each}
						</div>
					{/if}

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
							class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-400 cursor-pointer select-none transition-colors list-none"
						>
							<ArrowRightLeft class="w-3 h-3" />
							Transférer tout le matériel
						</summary>
						<form
							method="POST"
							action="?/transferer_tout"
							use:enhance={({ cancel }) => {
								if (!transferAllTarget) {
									cancel();
									return;
								}
								const dest = data.chauffeurs.find((c) => c.id_chauffeur === transferAllTarget);
								if (
									!confirm(
										`Transférer tous les EPI de ${selectedDriver?.nom} ${selectedDriver?.prenom} vers ${dest?.nom} ${dest?.prenom} ?`,
									)
								) {
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
		</div>

		<!-- ── Pied du panel ──────────────────────────────────────────────── -->
		<div
			class="shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3"
		>
			<button
				onclick={startEdit}
				class="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-700 text-sm font-black hover:bg-slate-200 transition-colors"
			>
				<Pencil class="w-4 h-4" />Modifier
			</button>

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
		</div>
	</div>
{/if}

