-- ─── F16: ABAL+ — Programa de Fidelización de Clientes ──────────────────────
--
-- Tablas:
--   puntos_mensuales  — puntos ganados por cliente por mes
--   tiers_clientes    — nivel actual de cada cliente (rolling 12 meses)
--
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tabla: puntos_mensuales ───────────────────────────────────────────────────
create table public.puntos_mensuales (
  id                  uuid primary key default gen_random_uuid(),
  idcliente           text not null references public.clientes(idcliente),
  anio                integer not null,
  mes                 text not null,        -- 'ENERO', 'FEBRERO', …, 'DICIEMBRE'

  -- Puntos base (calculados desde facturas)
  pts_volumen         integer not null default 0,  -- 1 pt por saco (cantidadar)
  pts_valor           integer not null default 0,  -- 2 pts por S/. 100 facturado
  pts_diversificacion integer not null default 0,  -- 150 bonus si ≥3 líneas distintas
  pts_frecuencia      integer not null default 0,  -- 100 bonus si ≥3 semanas distintas

  -- Bonus manuales (aniversario, meta, referido — se suman vía UPDATE)
  pts_bonus           integer not null default 0,

  -- Total calculado automáticamente
  total_puntos        integer generated always as (
    pts_volumen + pts_valor + pts_diversificacion + pts_frecuencia + pts_bonus
  ) stored,

  -- Metadata del cálculo
  sacos_total         numeric,             -- sacos comprados en el mes (informativo)
  valor_total         numeric,             -- S/. facturados en el mes (informativo)
  lineas_distintas    integer,             -- número de líneas distintas
  semanas_distintas   integer,             -- número de semanas distintas (S1..S4)
  calculado_at        timestamptz default now(),

  constraint puntos_mes_unico unique (idcliente, anio, mes)
);

create index idx_puntos_idcliente on public.puntos_mensuales(idcliente);
create index idx_puntos_anio_mes  on public.puntos_mensuales(anio, mes);

-- ── Tabla: tiers_clientes ─────────────────────────────────────────────────────
create table public.tiers_clientes (
  idcliente       text primary key references public.clientes(idcliente),
  tier            text not null default 'bronce'
                  check (tier in ('bronce', 'plata', 'oro')),
  puntos_12m      integer not null default 0,   -- suma rolling últimos 12 meses
  tier_anterior   text check (tier_anterior in ('bronce', 'plata', 'oro')),
  tier_desde      date,                          -- fecha en que alcanzó el nivel actual
  actualizado_at  timestamptz default now()
);

create index idx_tiers_tier on public.tiers_clientes(tier);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.puntos_mensuales enable row level security;
alter table public.tiers_clientes   enable row level security;

-- puntos_mensuales: gerente/supervisor ven todo; vendedor solo sus clientes
create policy "puntos_select_admin" on public.puntos_mensuales for select using (
  public.get_rol() in ('gerente', 'supervisor')
);
create policy "puntos_select_vendedor" on public.puntos_mensuales for select using (
  public.get_rol() = 'vendedor'
  and idcliente in (
    select idcliente from public.clientes
    where responsable = public.get_fuerza_de_venta()
  )
);
create policy "puntos_write_admin" on public.puntos_mensuales for all using (
  public.get_rol() in ('gerente', 'supervisor')
);

-- tiers_clientes: misma lógica
create policy "tiers_select_admin" on public.tiers_clientes for select using (
  public.get_rol() in ('gerente', 'supervisor')
);
create policy "tiers_select_vendedor" on public.tiers_clientes for select using (
  public.get_rol() = 'vendedor'
  and idcliente in (
    select idcliente from public.clientes
    where responsable = public.get_fuerza_de_venta()
  )
);
create policy "tiers_write_admin" on public.tiers_clientes for all using (
  public.get_rol() in ('gerente', 'supervisor')
);

-- ── Cron: calcular puntos el día 1 de cada mes a las 7:00 AM Perú (12:00 UTC) ─
-- PRERREQUISITO: pg_cron y pg_net deben estar habilitados (ver 003_cron_sync.sql)
-- PRERREQUISITO: app.service_role_key debe estar configurado (ver 003_cron_sync.sql)
--
-- Descomentar y ejecutar manualmente cuando las extensiones estén activas:
--
-- select cron.schedule(
--   'calcular-puntos-mensual',
--   '0 12 1 * *',
--   $$
--   select net.http_post(
--     url     := 'https://hbxfohohfuzzihjhzhcy.supabase.co/functions/v1/calcular-puntos',
--     headers := jsonb_build_object(
--       'Content-Type',  'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
--     ),
--     body    := '{}'::jsonb
--   ) as request_id;
--   $$
-- );
--
-- Para verificar: select * from cron.job;
-- Para eliminar:  select cron.unschedule('calcular-puntos-mensual');
-- ─────────────────────────────────────────────────────────────────────────────
