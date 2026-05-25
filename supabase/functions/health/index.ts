/**
 * Edge Function: health
 *
 * Health check para smoke tests post-deploy.
 * Valida que:
 *   1. La función responde (Deno + runtime OK)
 *   2. La cadena anon→RLS funciona (select 1 con anon key)
 *
 * GET /functions/v1/health
 *   Header: Authorization: Bearer <ANON_KEY>
 *
 * Respuesta 200: { ok: true, db: 'up', version: '<commit_sha>', ts: <iso> }
 * Respuesta 500: { ok: false, error: '<msg>' }
 *
 * NO usar SERVICE_ROLE_KEY aquí — el objetivo es validar que el flujo
 * real anon→RLS está operativo desde fuera del proyecto.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    // Probe trivial — cualquier tabla con RLS activa sirve. perfiles existe en F1.
    // count: 'exact' + head: true → no transfiere filas, solo verifica que la query
    // negocia con PostgREST sin error de auth/RLS.
    const { error } = await supabase
      .from('perfiles')
      .select('id', { count: 'exact', head: true })

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers },
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        db: 'up',
        version: Deno.env.get('DEPLOY_COMMIT') ?? 'unknown',
        ts: new Date().toISOString(),
      }),
      { headers },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers },
    )
  }
})
