<script lang="ts">
  import { supabase } from '$lib/supabase'
  import { onMount } from 'svelte'

  let status = $state("Test en cours...")

  onMount(async () => {
    const { data, error } = await supabase.from('chauffeur').select('*')
    
    if (error) {
      status = '❌ Erreur : ' + error.message
    } else {
      status = '✅ Connecté ! ' + data.length + ' chauffeur(s) en base.'
    }
  })
</script>

<p>{status}</p>