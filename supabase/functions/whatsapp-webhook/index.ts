/**
 * Edge Function: whatsapp-webhook
 *
 * Recibe webhooks del Meta WhatsApp Cloud API:
 *   - GET  → verificación inicial (Meta envía hub.challenge)
 *   - POST → eventos (mensajes entrantes, estados de envío)
 *
 * Configuración (Supabase Dashboard → Settings → Edge Functions → Secrets):
 *   WHATSAPP_VERIFY_TOKEN   token elegido por nosotros (Meta lo enviará en GET)
 *   WHATSAPP_APP_SECRET     app secret de Meta (para validar la firma X-Hub-Signature-256)
 *
 * Endpoint público: https://<project>.functions.supabase.co/whatsapp-webhook
 * Configurar este URL en Meta Developer Portal → WhatsApp → Configuration → Webhook.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? ''
const APP_SECRET   = Deno.env.get('WHATSAPP_APP_SECRET')   ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// ─── Validación de firma HMAC-SHA256 ─────────────────────────────────────────

async function verifyMetaSignature(body: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !APP_SECRET) return false
  const expected = signatureHeader.replace(/^sha256=/, '')

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const computed = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Timing-safe compare
  if (computed.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

// ─── Resolver cliente/prospecto por teléfono ─────────────────────────────────

async function resolverCliente(telefono: string): Promise<{ idcliente?: string; prospecto_id?: string }> {
  // 1) Buscar por número exacto en prospectos.contacto
  const { data: p } = await supabase
    .from('prospectos')
    .select('id')
    .ilike('contacto', `%${telefono.slice(-9)}%`) // matcheo por últimos 9 dígitos (sin código país)
    .limit(1)
    .maybeSingle()

  if (p?.id) return { prospecto_id: p.id }

  // 2) (Futuro) buscar en clientes.contacto cuando ese campo exista
  return {}
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleVerification(url: URL): Promise<Response> {
  const mode      = url.searchParams.get('hub.mode')
  const token     = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

async function handleEvent(req: Request): Promise<Response> {
  const body = await req.text()
  const ok = await verifyMetaSignature(body, req.headers.get('x-hub-signature-256'))
  if (!ok) return new Response('Invalid signature', { status: 401 })

  let payload: { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<unknown>; statuses?: Array<unknown> } }> }> }
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  // Meta agrupa eventos: entry[].changes[].value.messages[]
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages ?? []
      for (const msg of messages as Array<{ id?: string; from?: string; type?: string; text?: { body?: string } }>) {
        if (!msg.id || !msg.from) continue

        const tipo: string = msg.type === 'text' ? 'texto'
          : msg.type === 'image'    ? 'imagen'
          : msg.type === 'document' ? 'documento'
          : msg.type === 'audio'    ? 'audio'
          : msg.type === 'video'    ? 'video'
          : 'otro'

        const contenido = msg.text?.body ?? null
        const resuelto = await resolverCliente(msg.from)

        await supabase.from('whatsapp_mensajes').insert({
          wa_message_id: msg.id,
          direccion: 'entrante',
          telefono: msg.from,
          tipo,
          contenido,
          idcliente: resuelto.idcliente ?? null,
          prospecto_id: resuelto.prospecto_id ?? null,
          payload_raw: msg,
          status: 'recibido',
        })

        // Si está ligado a un prospecto, dejar actividad
        if (resuelto.prospecto_id) {
          await supabase.from('actividad').insert({
            tipo: 'nota',
            prospecto_id: resuelto.prospecto_id,
            // usuario_id: ⚠ webhook no tiene usuario_id de Supabase. Usar usuario "sistema"
            // (nil UUID) y filtrar en la UI. Requiere crear ese profile previamente.
            usuario_id: '00000000-0000-0000-0000-000000000000',
            nota: `📱 WhatsApp entrante: ${contenido?.slice(0, 200) ?? '(media)'}`,
          })
        }
      }
    }
  }

  // Meta espera 200 OK rápido o reintenta
  return new Response('OK', { status: 200 })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'GET')  return handleVerification(url)
  if (req.method === 'POST') return handleEvent(req)
  return new Response('Method Not Allowed', { status: 405 })
})
