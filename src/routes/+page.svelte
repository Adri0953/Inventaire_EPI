<script lang="ts">
  import background from '$lib/assets/samatreal.png';
  export let form;

  let showPassword = false;
</script>

<div class="login-wrapper" style="--pattern: url({background})">
  <div class="login-overlay"></div>

  <div class="login-right">
    <div class="login-card">
      <div class="login-header">
        <h2>Connexion</h2>
      </div>

      <form method="POST" action="?/login" class="login-form">
        <div class="field">
          <label for="email">Adresse email</label>
          <div class="input-wrapper">
            <svg
              class="input-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
              ></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <input id="email" name="email" type="email" placeholder="exemple@samat.fr" required />
          </div>
        </div>

        <div class="field">
          <label for="password">Mot de passe</label>
          <div class="input-wrapper">
            <svg
              class="input-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              class="toggle-pw"
              onclick={() => (showPassword = !showPassword)}
              tabindex="-1"
            >
              {#if showPassword}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"
                  ></path>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"
                  ></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              {:else}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              {/if}
            </button>
          </div>
        </div>

        {#if form?.error}
          <div class="error-banner">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {form.error}
          </div>
        {/if}

        <button type="submit" class="btn-submit">
          Se connecter
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </form>
    </div>
  </div>
</div>

<style>
  :global(.app-main) {
    padding: 0 !important;
    align-items: stretch !important;
  }

  .login-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: calc(100vh - 64px);
    padding: 2rem;
    box-sizing: border-box;
    /* motif animé en fond plein écran */
    background-image: var(--pattern);
    background-repeat: repeat;
    background-size: 180px 127.2px;
    background-color: #eef4ff;
    animation: pattern-scroll 12s linear infinite;
  }

  @keyframes pattern-scroll {
    from {
      background-position: 0 0;
    }
    to {
      /* décalage diagonal bas-droite d'une tuile complète (= background-size) */
      background-position: 180px 127.2px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .login-wrapper {
      animation: none;
    }
  }

  /* voile pour adoucir le motif derrière la carte */
  .login-overlay {
    position: absolute;
    inset: 0;
    background: rgba(238, 244, 255, 0.55);
  }

  /* ── Carte centrée ── */
  .login-right {
    position: relative;
    z-index: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .login-card {
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    background: white;
    padding: 3.5rem;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(15, 23, 64, 0.18);
  }

  .login-header {
    text-align: center;
  }

  .login-header h2 {
    font-size: 2.25rem;
    font-weight: 800;
    color: #0f1740;
    letter-spacing: -0.04em;
    margin: 0 0 0.35rem;
  }

  .login-header p {
    font-size: 0.9rem;
    color: #64748b;
    margin: 0;
  }

  /* ── Formulaire ── */
  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #374151;
    letter-spacing: 0.01em;
  }

  .input-wrapper {
    position: relative;
  }

  .input-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    height: 18px;
    color: #94a3b8;
    pointer-events: none;
    flex-shrink: 0;
  }

  input {
    width: 100%;
    padding: 1rem 3rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    font-size: 1.0625rem;
    color: #0f172a;
    background: white;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
    box-sizing: border-box;
    outline: none;
  }

  input::placeholder {
    color: #cbd5e1;
  }

  input:focus {
    border-color: #1e3a8a;
    box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
  }

  .toggle-pw {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    color: #94a3b8;
    transition: color 0.15s;
  }

  .toggle-pw:hover {
    color: #475569;
  }

  .toggle-pw svg {
    width: 18px;
    height: 18px;
  }

  /* ── Erreur ── */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #dc2626;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .error-banner svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  /* ── Bouton ── */
  .btn-submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 1.0625rem;
    background: linear-gradient(135deg, #1e3a8a 0%, #2d55c8 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1.0625rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      transform 0.15s,
      box-shadow 0.15s;
    margin-top: 0.5rem;
    letter-spacing: 0.01em;
  }

  .btn-submit svg {
    width: 18px;
    height: 18px;
    transition: transform 0.2s;
  }

  .btn-submit:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(30, 58, 138, 0.35);
  }

  .btn-submit:hover svg {
    transform: translateX(3px);
  }

  .btn-submit:active {
    transform: translateY(0);
    box-shadow: none;
  }
</style>
