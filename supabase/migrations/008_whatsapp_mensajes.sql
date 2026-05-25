-- 008_whatsapp_mensajes.sql
-- Log de mensajes entrantes/salientes de WhatsApp Business API (Meta Cloud API).
-- El propósito es:
--   1) Auditoría: saber qué se envió y qué llegó.
--   2) Vinculación: por número de teléfono, asociar el mensaje a un cliente / prospecto.
--   3) UI: mostrar timeline en la página del cliente.
--
-- La policy permite que el supervisor/gerente lean todos y el vendedor solo los
-- mensajes asociados a clientes de su fuerza_de_venta (vía join).

create table public.whatsapp_mensajes (
  id              uuid primary key default gen_random_uuid(),
  wa_message_id   text unique,                                -- id de Meta
  direccion       text not null check (direccion in ('entrante', 'saliente')),
  telefono        text not null,                              -- E.164: +51999...
  tipo            text not null check (tipo in ('texto', 'imagen', 'documento', 'audio', 'video', 'plantilla', 'otro')),
  contenido       text,                                       -- texto o caption
  media_url       text,                                       -- si aplica
  idcliente       text references public.clientes(idcliente), -- resuelto por teléfono
  prospecto_id    uuid references public.prospectos(id),      -- si match contra prospecto
  enviado_por     uuid references public.profiles(id),        -- vendedor que envió (null si entrante)
  payload_raw     jsonb,                                      -- payload completo de Meta para depurar
  status          text default 'recibido',                    -- recibido | leido | error
  created_at      timestamptz default now()
);

create index idx_wa_mensajes_telefono   on public.whatsapp_mensajes(telefono);
create index idx_wa_mensajes_idcliente  on public.whatsapp_mensajes(idcliente);
create index idx_wa_mensajes_prospecto  on public.whatsapp_mensajes(prospecto_id);
create index idx_wa_mensajes_created    on public.whatsapp_mensajes(created_at desc);

alter table public.whatsapp_mensajes enable row level security;

-- Admin (gerente/supervisor) ve todo
create policy "wa_select_admin" on public.whatsapp_mensajes for select using (
  public.get_rol() in ('gerente', 'supervisor')
);

-- Vendedor ve solo mensajes ligados a sus clientes
create policy "wa_select_vendedor" on public.whatsapp_mensajes for select using (
  public.get_rol() = 'vendedor'
  and idcliente in (
    select idcliente from public.clientes
    where responsable = public.get_fuerza_de_venta()
  )
);

-- Insert: solo el sistema (vía service_role en Edge Function). Frontend no inserta.
-- (no creamos policy de insert → solo service_role bypass RLS podrá escribir)

-- Comentarios para auditoría
comment on table  public.whatsapp_mensajes is 'Log de WhatsApp Cloud API. Entradas vienen de webhook /functions/v1/whatsapp-webhook';
comment on column public.whatsapp_mensajes.payload_raw is 'Payload original de Meta — útil para debugging y replay';
