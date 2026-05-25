# WhatsApp Cloud API — Integración (scaffolding)

**Estado:** scaffolding listo, **no conectado a Meta todavía**.
Falta crear app en Meta Developer Portal, configurar verify token y desplegar la Edge Function.

## Qué se entrega ya

| Pieza | Archivo |
|-------|---------|
| Tabla de log + RLS | [`supabase/migrations/008_whatsapp_mensajes.sql`](../supabase/migrations/008_whatsapp_mensajes.sql) |
| Edge Function webhook | [`supabase/functions/whatsapp-webhook/index.ts`](../supabase/functions/whatsapp-webhook/index.ts) |

La Edge Function ya:
- Maneja la verificación inicial de Meta (GET con `hub.challenge`)
- Valida la firma HMAC `X-Hub-Signature-256` con timing-safe compare
- Inserta mensajes entrantes en `whatsapp_mensajes`
- Vincula al prospecto por número (últimos 9 dígitos)
- Crea actividad en el timeline del prospecto

## Pasos para activar

### 1. Crear app en Meta

1. https://developers.facebook.com/apps/ → Create app → Business
2. Add product → WhatsApp → API Setup
3. Anotar:
   - **Phone Number ID** (para enviar mensajes desde el CRM)
   - **WhatsApp Business Account ID**
   - **Access Token** (temporal de 24h, después generar uno permanente con System User)

### 2. Configurar secrets en Supabase

Dashboard → Project Settings → Edge Functions → Secrets:

```
WHATSAPP_VERIFY_TOKEN=<elige una palabra random, ej. "abal-crm-2026-secreto">
WHATSAPP_APP_SECRET=<App Secret de la app de Meta>
WHATSAPP_ACCESS_TOKEN=<token permanente de System User>   # solo si vas a enviar mensajes
WHATSAPP_PHONE_NUMBER_ID=<Phone Number ID>                # idem
```

### 3. Aplicar migración

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/008_whatsapp_mensajes.sql
# o vía Dashboard → SQL Editor
```

### 4. Desplegar Edge Function

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

⚠️ El `--no-verify-jwt` es obligatorio: Meta no envía JWT, llama al endpoint directo.
La seguridad la da la verificación de la firma HMAC contra `WHATSAPP_APP_SECRET`.

### 5. Conectar el webhook en Meta

Meta Developer → tu app → WhatsApp → Configuration → Webhook:
- **Callback URL:** `https://hbxfohohfuzzihjhzhcy.functions.supabase.co/whatsapp-webhook`
- **Verify Token:** el valor de `WHATSAPP_VERIFY_TOKEN` de arriba
- **Webhook fields:** suscribirse a `messages` y `message_status`

Al guardar, Meta hace un GET — la Edge Function responde con el challenge y queda verificado.

### 6. Probar

Desde el sandbox de Meta (o desde un teléfono real) envía un mensaje al número de WhatsApp Business.
Verificar:
```sql
select * from public.whatsapp_mensajes order by created_at desc limit 5;
```

## Roadmap (no scaffolded aún)

| Feature | Archivos sugeridos |
|---------|--------------------|
| Enviar mensajes desde el CRM | `supabase/functions/whatsapp-send/index.ts` — POST con `{telefono, texto}`, llama a `graph.facebook.com/v18.0/<PHONE_NUMBER_ID>/messages` |
| Plantillas pre-aprobadas | mismo endpoint, payload tipo `template` |
| UI en página del cliente | Nueva pestaña "WhatsApp" en `ClienteDetallePage.tsx` con timeline + composer |
| Sync de estados (leído/entregado) | Procesar `change.value.statuses` en webhook |
| Resolver clientes por `clientes.contacto` | Agregar columna `contacto` a `clientes` o tabla `contactos` polimórfica |

## Sobre la vinculación por teléfono

La lógica actual (`resolverCliente` en la Edge Function):
1. Busca en `prospectos.contacto` por los últimos 9 dígitos.
2. Si no encuentra, deja el mensaje "huérfano" (sin `idcliente` ni `prospecto_id`).

Esto es **intencional**: un mensaje no vinculado se puede asociar manualmente desde la UI
después. No descartamos el mensaje porque podría ser un lead nuevo.

## Cumplimiento

- **Mensajes salientes**: Meta exige plantillas pre-aprobadas para mensajes fuera de la ventana
  de 24h tras la última interacción del cliente. Dentro de esa ventana, texto libre OK.
- **Opt-in**: necesitas consentimiento explícito antes de enviarle a alguien. El CRM debe
  marcar un cliente como `whatsapp_opt_in = true` antes de habilitar el botón de envío.
- **Datos personales**: `payload_raw` puede contener mensajes — entra en políticas de
  privacidad. Considerar `TRUNCATE` periódico o anonimización tras X meses.
