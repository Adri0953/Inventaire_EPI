<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import {
		UserPlus,
		ArrowLeft,
		ShieldCheck,
		Plus,
		Minus,
		Calendar,
		Package,
		ChevronDown,
		Zap,
	} from 'lucide-svelte';
	import { untrack } from 'svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const ACTIVITES = [
		'Livraison longue distance',
		'Transport urbain',
		'Manutention',
		'Conduite de chariots',
		'Logistique entrepôt',
	];

	// Types de preset à faire correspondre avec modele_epi.type et designation
	const PRESETS: Record<string, string[]> = {
		'Livraison longue distance': ['chaussures', 'gilet', 'gants'],
		'Transport urbain': ['chaussures', 'gilet'],
		'Manutention': ['chaussures', 'gants', 'casque', 'gilet'],
		'Conduite de chariots': ['chaussures', 'casque', 'gilet', 'gants'],
		'Logistique entrepôt': ['chaussures', 'gilet', 'gants'],
	};

	let prenom = $state('');
	let nom = $state('');
	let activite = $state('');
	let isSubmitting = $state(false);

	type Selection = { epi_id: string; expiration: string };
	let selections = $state<Record<string, Selection>>({});
	let selectedModeleIds = $state<string[]>([]);

	const today = new Date().toISOString().split('T')[0];
	const oneYearFromNow = (() => {
		const d = new Date();
		d.setFullYear(d.getFullYear() + 1);
		return d.toISOString().split('T')[0];
	})();

	const instancesByModele = $derived.by(() => {
		const map: Record<string, Array<{ id_epi: string; date_expiration: string | null }>> = {};
		for (const epi of data.episDisponibles) {
			if (!map[epi.id_modele_epi]) map[epi.id_modele_epi] = [];
			map[epi.id_modele_epi].push(epi);
		}
		return map;
	});

	const matchesPreset = (m: (typeof data.modeles)[0], keywords: string[]) => {
		const text = `${m.type ?? ''} ${m.designation}`.toLowerCase();
		return keywords.some((k) => text.includes(k));
	};

	const presetModeleIds = $derived.by(() => {
		if (!activite) return new Set<string>();
		const keywords = PRESETS[activite] ?? [];
		return new Set(
			data.modeles.filter((m) => matchesPreset(m, keywords)).map((m) => m.id_modele_epi),
		);
	});

	// Quand l'activité change → remplacer la sélection par le preset
	// untrack évite que la lecture de `selections` ne crée une dépendance cyclique
	$effect(() => {
		const keywords = PRESETS[activite] ?? [];
		const ids = data.modeles
			.filter((m) => matchesPreset(m, keywords))
			.map((m) => m.id_modele_epi);
		selectedModeleIds = ids;
		const valid = new Set(ids);
		const prev = untrack(() => selections);
		const next: Record<string, Selection> = {};
		for (const k in prev) {
			if (valid.has(k)) next[k] = prev[k];
		}
		selections = next;
	});

	function toggleModele(id: string) {
		if (selectedModeleIds.includes(id)) {
			selectedModeleIds = selectedModeleIds.filter((x) => x !== id);
			const next = { ...selections };
			delete next[id];
			selections = next;
		} else {
			selectedModeleIds = [...selectedModeleIds, id];
		}
	}

	function pickInstance(modeleId: string, epiId: string) {
		const epi = data.episDisponibles.find((e) => e.id_epi === epiId);
		selections = {
			...selections,
			[modeleId]: {
				epi_id: epiId,
				expiration: epi?.date_expiration ?? selections[modeleId]?.expiration ?? '',
			},
		};
	}

	function setExpiration(modeleId: string, value: string) {
		selections = {
			...selections,
			[modeleId]: { ...(selections[modeleId] ?? { epi_id: '' }), expiration: value },
		};
	}

	const episJson = $derived(
		JSON.stringify(
			selectedModeleIds
				.map((id) => ({
					id_epi: selections[id]?.epi_id ?? '',
					expiration: selections[id]?.expiration ?? '',
				}))
				.filter((e) => e.id_epi !== ''),
		),
	);

	const canSubmit = $derived(prenom.trim() !== '' && nom.trim() !== '' && !isSubmitting);

	const unselectedModeles = $derived(
		data.modeles.filter((m) => !selectedModeleIds.includes(m.id_modele_epi)),
	);

	const formatDate = (d: string | null) =>
		d
			? new Date(d).toLocaleDateString('fr-FR', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric',
				})
			: '—';

	function shortUUID(uuid: string) {
		return uuid.slice(0, 8).toUpperCase();
	}
</script>

<div
	class="w-full max-w-4xl mx-auto p-4 lg:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700"
>
	<!-- En-tête -->
	<div class="flex items-center gap-4">
		<a
			href="/dashboard"
			class="p-2.5 rounded-2xl bg-white shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all"
		>
			<ArrowLeft class="w-5 h-5 text-slate-600" />
		</a>
		<div>
			<p class="text-xs font-black uppercase tracking-widest text-slate-400">Chauffeurs</p>
			<h1 class="text-2xl font-black text-blue-950 tracking-tight">Nouveau chauffeur</h1>
		</div>
	</div>

	<form
		method="POST"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				await update();
				isSubmitting = false;
			};
		}}
		class="space-y-8"
	>
		<input type="hidden" name="epis" value={episJson} />

		<!-- ── INFORMATIONS DE BASE ───────────────── -->
		<div class="bg-white rounded-4xl shadow-xl border-2 border-blue-100 overflow-hidden">
			<div class="p-8 bg-linear-to-br from-blue-900 to-blue-700 relative overflow-hidden">
				<UserPlus class="absolute -right-4 -top-4 w-32 h-32 text-white/10 rotate-12" />
				<div class="relative z-10">
					<h2 class="text-2xl font-black text-white tracking-tight">Informations de base</h2>
					<p class="text-blue-200 text-xs font-bold mt-1 uppercase tracking-widest">
						Identité du chauffeur
					</p>
				</div>
			</div>

			<div class="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="space-y-2">
					<label
						for="prenom"
						class="block text-xs font-black uppercase tracking-widest text-slate-400"
					>
						Prénom <span class="text-red-400">*</span>
					</label>
					<input
						id="prenom"
						name="prenom"
						type="text"
						required
						bind:value={prenom}
						placeholder="Jean"
						class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-slate-50 font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
					/>
				</div>

				<div class="space-y-2">
					<label for="nom" class="block text-xs font-black uppercase tracking-widest text-slate-400">
						Nom <span class="text-red-400">*</span>
					</label>
					<input
						id="nom"
						name="nom"
						type="text"
						required
						bind:value={nom}
						placeholder="Dupont"
						class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-slate-50 font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
					/>
				</div>

				<div class="md:col-span-2 space-y-2">
					<label
						for="activite"
						class="block text-xs font-black uppercase tracking-widest text-slate-400"
					>
						Activité
					</label>
					<div class="relative">
						<select
							id="activite"
							name="activite"
							bind:value={activite}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-slate-50 font-medium text-slate-800 focus:outline-none focus:border-blue-400 focus:bg-white transition-all appearance-none"
						>
							<option value="">— Sélectionner une activité —</option>
							{#each ACTIVITES as act}
								<option value={act}>{act}</option>
							{/each}
						</select>
						<ChevronDown
							class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
						/>
					</div>
					{#if activite}
						<p class="text-xs text-indigo-500 font-bold flex items-center gap-1.5 mt-1">
							<Zap class="w-3 h-3" />
							Preset "{activite}" appliqué — {presetModeleIds.size} EPI recommandé{presetModeleIds.size >
							1
								? 's'
								: ''}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- ── ATTRIBUTION DES EPI ───────────────── -->
		<div class="bg-white rounded-4xl shadow-xl border-2 border-indigo-100 overflow-hidden">
			<div class="p-8 bg-linear-to-br from-indigo-900 to-indigo-700 relative overflow-hidden">
				<ShieldCheck class="absolute -right-4 -top-4 w-32 h-32 text-white/10 -rotate-12" />
				<div class="relative z-10 flex items-center justify-between">
					<div>
						<h2 class="text-2xl font-black text-white tracking-tight">Attribution des EPI</h2>
						<p class="text-indigo-200 text-xs font-bold mt-1 uppercase tracking-widest">
							Équipements à attribuer à la création
						</p>
					</div>
					<div
						class="bg-white/20 backdrop-blur-md rounded-2xl px-4 py-1.5 border border-white/30 tabular-nums"
					>
						<span class="text-sm font-black text-white">{selectedModeleIds.length}</span>
					</div>
				</div>
			</div>

			<div class="p-6 space-y-4">
				<!-- Liste des EPI sélectionnés -->
				{#each selectedModeleIds as modeleId (modeleId)}
					{@const modele = data.modeles.find((m) => m.id_modele_epi === modeleId)}
					{@const instances = instancesByModele[modeleId] ?? []}
					{@const sel = selections[modeleId]}
					{@const isPreset = presetModeleIds.has(modeleId)}
					{#if modele}
						<div
							class="rounded-3xl border-2 overflow-hidden transition-all {isPreset
								? 'border-indigo-100 bg-indigo-50/30'
								: 'border-slate-100 bg-slate-50/20'}"
						>
							<!-- En-tête de la ligne EPI -->
							<div class="flex items-center justify-between px-5 py-4">
								<div class="flex items-center gap-3 min-w-0">
									{#if isPreset}
										<span
											class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-200 text-[9px] font-black text-indigo-700 uppercase"
										>
											<Zap class="w-2.5 h-2.5" /> Preset
										</span>
									{/if}
									<div class="min-w-0">
										<p class="font-bold text-sm text-blue-950 truncate">{modele.designation}</p>
										<p class="text-xs text-slate-400 mt-0.5">
											{modele.type ?? '—'}{modele.taille ? ` · ${modele.taille}` : ''}
										</p>
									</div>
								</div>
								<button
									type="button"
									onclick={() => toggleModele(modeleId)}
									class="shrink-0 p-1.5 rounded-xl bg-red-50 border border-red-100 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all ml-3"
									title="Retirer cet EPI"
								>
									<Minus class="w-4 h-4" />
								</button>
							</div>

							<!-- Détails : exemplaire + expiration -->
							<div class="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
								<div class="space-y-1.5">
									<p class="text-[10px] font-black uppercase tracking-widest text-slate-400">
										Exemplaire physique
									</p>
									{#if instances.length > 0}
										<div class="relative">
											<select
												value={sel?.epi_id ?? ''}
												onchange={(e) => pickInstance(modeleId, e.currentTarget.value)}
												class="w-full px-3 py-2.5 rounded-xl border-2 font-medium text-sm text-slate-800 focus:outline-none transition-all appearance-none
													{sel?.epi_id
													? 'border-emerald-300 bg-emerald-50'
													: 'border-amber-200 bg-amber-50'}"
											>
												<option value="">— Choisir un exemplaire —</option>
												{#each instances as epi}
													<option value={epi.id_epi}>
														#{shortUUID(epi.id_epi)}{epi.date_expiration
															? ` · exp. ${formatDate(epi.date_expiration)}`
															: ''}
													</option>
												{/each}
											</select>
											<ChevronDown
												class="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
											/>
										</div>
										{#if instances.length > 1}
											<p class="text-[10px] text-slate-400 font-medium">
												{instances.length} exemplaires disponibles
											</p>
										{/if}
									{:else}
										<div class="px-3 py-2.5 rounded-xl border-2 border-red-100 bg-red-50">
											<p class="text-xs font-bold text-red-500">Aucun exemplaire disponible en stock</p>
										</div>
									{/if}
								</div>

								<div class="space-y-1.5">
									<p class="text-[10px] font-black uppercase tracking-widest text-slate-400">
										Date d'expiration
									</p>
									<div class="flex gap-2">
										<input
											type="date"
											value={sel?.expiration ?? ''}
											oninput={(e) => setExpiration(modeleId, e.currentTarget.value)}
											class="flex-1 min-w-0 px-3 py-2.5 rounded-xl border-2 border-slate-100 bg-slate-50 font-medium text-sm text-slate-800 focus:outline-none focus:border-blue-400 transition-all"
										/>
										<button
											type="button"
											onclick={() => setExpiration(modeleId, oneYearFromNow)}
											class="shrink-0 px-3 py-2.5 rounded-xl bg-blue-50 border-2 border-blue-100 text-blue-600 hover:bg-blue-100 transition-all text-xs font-black whitespace-nowrap"
											title="Fixer à dans 1 an"
										>
											+ 1 an
										</button>
									</div>
								</div>
							</div>
						</div>
					{/if}
				{/each}

				{#if selectedModeleIds.length === 0}
					<div class="flex flex-col items-center gap-3 py-12 opacity-30">
						<Package class="w-12 h-12 text-slate-400" />
						<p class="text-xs font-black uppercase tracking-widest text-center text-slate-500">
							Sélectionnez une activité ou ajoutez des EPI manuellement
						</p>
					</div>
				{/if}

				<!-- Ajouter des EPI manuellement -->
				{#if unselectedModeles.length > 0}
					<div class="pt-4 border-t border-slate-100">
						<p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
							Ajouter un EPI
						</p>
						<div class="flex flex-wrap gap-2">
							{#each unselectedModeles as modele (modele.id_modele_epi)}
								{@const available = (instancesByModele[modele.id_modele_epi] ?? []).length}
								<button
									type="button"
									onclick={() => toggleModele(modele.id_modele_epi)}
									disabled={available === 0}
									class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-all
										{available > 0
										? 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'
										: 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'}"
								>
									<Plus class="w-3 h-3 shrink-0" />
									<span class="truncate max-w-40">{modele.designation}</span>
									{#if available > 0}
										<span
											class="shrink-0 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-black"
											>{available}</span
										>
									{:else}
										<span class="shrink-0 text-[9px] text-red-300 font-black">ÉPUISÉ</span>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Note date d'attribution -->
		<div
			class="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-50 border border-emerald-200"
		>
			<Calendar class="w-4 h-4 text-emerald-500 shrink-0" />
			<p class="text-xs font-bold text-emerald-700">
				Date d'attribution fixée automatiquement à aujourd'hui :
				<span class="font-black">{formatDate(today)}</span>
			</p>
		</div>

		<!-- Message d'erreur -->
		{#if form?.error}
			<div class="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-red-50 border border-red-200">
				<p class="text-sm font-bold text-red-600">{form.error}</p>
			</div>
		{/if}

		<!-- Bouton de validation -->
		<div class="flex justify-end pb-4">
			<button
				type="submit"
				disabled={!canSubmit}
				class="flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-white shadow-xl transition-all duration-300
					{canSubmit
					? 'bg-linear-to-br from-blue-800 to-blue-600 hover:shadow-blue-200 hover:scale-[1.02] hover:shadow-2xl'
					: 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}"
			>
				{#if isSubmitting}
					<div
						class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
					></div>
					Création en cours…
				{:else}
					<UserPlus class="w-5 h-5" />
					Créer le chauffeur
				{/if}
			</button>
		</div>
	</form>
</div>
