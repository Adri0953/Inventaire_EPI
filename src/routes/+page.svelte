<script lang="ts">
  export let form;
</script>

<div class="login-container">
  <form method="POST" action="?/login">
    <div class="form-group">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required />
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required />
    </div>

    {#if form?.error}
      <p class="error">{form.error}</p>
    {/if}

    <button type="submit" class="btn-primary">Connexion</button>
  </form>
</div>

<style>
  .login-container {
    background-color: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    color: #4a5568;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #cbd5e0;
    border-radius: 4px;
    font-size: 1rem;
  }

  .btn-primary {
    width: 100%;
    padding: 0.75rem;
    background-color: #2c5282;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.3s;
  }

  .btn-primary:hover {
    background-color: #2a4365;
  }

  .error {
    color: #e53e3e;
    text-align: center;
    margin-bottom: 1rem;
  }
</style>
