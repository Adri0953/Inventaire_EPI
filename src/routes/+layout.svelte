<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import logo from '$lib/assets/logo.jpg';
  export let data;
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="app">
  <header class="app-header">
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href="/dashboard" class="header-title">
      <img src={logo} alt="Logo" class="w-10 h-10" />
      <h1>Inventaire EPI</h1>
    </a>
    {#if data.session}
      <form method="POST" action="/?/logout">
        <button type="submit" class="btn-logout">Déconnexion</button>
      </form>
    {/if}
  </header>

  <main class="app-main">
    <slot />
  </main>
</div>
