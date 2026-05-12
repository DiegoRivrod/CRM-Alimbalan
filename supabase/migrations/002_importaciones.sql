-- ─── F11: Historial de importaciones ─────────────────────────────────────────
-- Registra cada operación de importación para auditoría y prevención de duplicados.

create table public.importaciones (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null check (tipo in ('facturas', 'visitas', 'maestros')),
  mes_importacion  text,                        -- ej: 'ABRIL_2026' (solo tipo='facturas')
  filas_procesadas integer not null default 0,
  filas_omitidas   integer not null default 0,
  prospectos_conv  integer not null default 0,  -- prospectos auto-convertidos (tipo='facturas')
  usuario_id       uuid references auth.users(id) not null,
  created_at       timestamptz default now()
);

create index idx_importaciones_tipo       on public.importaciones(tipo);
create index idx_importaciones_mes        on public.importaciones(mes_importacion);
create index idx_importaciones_created_at on public.importaciones(created_at desc);

-- RLS
alter table public.importaciones enable row level security;

-- gerente/supervisor ven todo
create policy "importaciones_select_admin" on public.importaciones for select using (
  public.get_rol() in ('gerente', 'supervisor')
);
-- cada usuario ve las suyas propias
create policy "importaciones_select_own" on public.importaciones for select using (
  usuario_id = auth.uid()
);
-- cualquier usuario autenticado puede insertar
create policy "importaciones_insert" on public.importaciones for insert with check (
  auth.uid() is not null
);
