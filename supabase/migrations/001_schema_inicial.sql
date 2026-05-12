-- ============================================================
-- CRM COMERCIAL — Schema inicial
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ─── EXTENSIONES ────────────────────────────────────────────
create extension if not exists "pg_trgm"; -- para búsqueda fuzzy de prospectos

-- ─── PROFILES (extiende auth.users de Supabase) ────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  nombre       text not null,
  rol          text not null check (rol in ('gerente', 'supervisor', 'vendedor')),
  fuerza_de_venta text,           -- coincide con RESPONSABLE en clientes
  created_at   timestamptz default now()
);

-- Crear perfil automáticamente al registrar usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nombre, rol)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email), 'vendedor');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── MAESTROS ───────────────────────────────────────────────
create table public.clientes (
  idcliente          text primary key,
  razon_sg           text,
  id_razon           text,
  nombre             text not null,
  responsable        text,           -- FUERZA DE VENTA asignada
  zona               text,
  departamento       text,
  provincia          text,
  distrito           text,
  vendedor           text,           -- empresa distribuidora
  localizacion       text,
  lista_precios      text,
  canal_cluster      text,
  top                text,
  status             text default 'ACTIVO',
  cod                text,           -- COD META (clave para metas)
  meta_departamento  numeric,
  meta_top           numeric,
  meta_canal_cluster numeric,
  canal_truchas      text,
  meta_truchas_puno  numeric,
  meta_semana_1      numeric,
  meta_semana_2      numeric,
  meta_semana_3      numeric,
  meta_semana_4      numeric,
  updated_at         timestamptz default now()
);

create table public.productos (
  idarticulo   text primary key,
  descripcio   text not null,
  lineas       text,
  marca        text,
  presentacion text,
  peso_saco    integer,
  tipo         text,
  meta         integer default 0,
  updated_at   timestamptz default now()
);

create table public.metas (
  cod           text primary key,
  zona_de_venta text not null,
  meta          integer not null default 0,
  updated_at    timestamptz default now()
);

-- ─── TRANSACCIONAL ──────────────────────────────────────────
create table public.facturas (
  id             uuid primary key default gen_random_uuid(),
  tipodocume     text not null,    -- 'Facturas' | 'Boletas de Venta' | 'Notas de Crédito'
  idserie        text not null,
  numero         text not null,
  docventa       text generated always as (idserie || '-' || numero) stored,
  fecha          date not null,
  descondici     text,
  idcliente      text references public.clientes(idcliente),
  nombre         text not null,
  idarticulo     text references public.productos(idarticulo),
  desarticul     text,
  cantidadar     numeric,
  pesokgrtot     numeric,
  valortotal     numeric not null,
  vendedor       text,
  lineas         text,
  marca          text,
  mes            text,
  anio           integer,
  semana         text,
  departamento   text,
  provincia      text,
  distrito       text,
  zona           text,
  fuerza_de_venta text,
  canal          text,
  canal_cluster  text,
  cod_meta       text,
  mes_importacion text,            -- ej: 'ABRIL_2026'
  created_at     timestamptz default now()
);

create index idx_facturas_idcliente     on public.facturas(idcliente);
create index idx_facturas_fecha         on public.facturas(fecha);
create index idx_facturas_fuerza        on public.facturas(fuerza_de_venta);
create index idx_facturas_mes_anio      on public.facturas(mes, anio);
create index idx_facturas_mes_import    on public.facturas(mes_importacion);

-- ─── VISITAS (Google Forms normalizado) ─────────────────────
create table public.visitas (
  id                     uuid primary key default gen_random_uuid(),
  marca_temporal         timestamptz not null,
  fuerza_de_venta        text not null,
  localizacion           text,
  latitud                numeric,
  longitud               numeric,
  numero_visita          smallint not null check (numero_visita between 1 and 4),
  es_cliente_nuevo       boolean not null default false,
  idcliente              text references public.clientes(idcliente),
  nombre_cliente_nuevo   text,              -- texto libre si es nuevo
  contacto               text,
  zona                   text,
  tipo_cliente           text,
  especie                text,
  animales               integer,
  granjas                integer,
  procedencia            text,
  problema_abastecimiento text,
  lineas_productos       text,
  potencial_consumo_tn   numeric,
  marcas_consume         text,
  created_at             timestamptz default now(),
  constraint visita_cliente_check check (
    (es_cliente_nuevo = false and idcliente is not null) or
    (es_cliente_nuevo = true  and nombre_cliente_nuevo is not null)
  )
);

create index idx_visitas_fuerza       on public.visitas(fuerza_de_venta);
create index idx_visitas_temporal     on public.visitas(marca_temporal);
create index idx_visitas_idcliente    on public.visitas(idcliente);
create index idx_visitas_nuevo        on public.visitas(es_cliente_nuevo);

-- ─── PROSPECTOS ─────────────────────────────────────────────
create table public.prospectos (
  id                      uuid primary key default gen_random_uuid(),
  visita_id               uuid references public.visitas(id),
  nombre                  text not null,
  contacto                text,
  fuerza_de_venta         text not null,
  zona                    text,
  especie                 text,
  potencial_tn            numeric,
  marcas_consume          text,
  estado                  text not null default 'nuevo'
                          check (estado in ('nuevo', 'seguimiento', 'convertido', 'perdido')),
  -- match con cliente existente
  idcliente_sugerido      text references public.clientes(idcliente),
  match_confianza         numeric check (match_confianza between 0 and 1),
  match_aprobado          boolean not null default false,
  match_aprobado_por      uuid references public.profiles(id),
  match_aprobado_at       timestamptz,
  -- conversión
  primera_factura_docventa text,
  fecha_conversion        date,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create index idx_prospectos_estado    on public.prospectos(estado);
create index idx_prospectos_fuerza    on public.prospectos(fuerza_de_venta);
create index idx_prospectos_nombre    on public.prospectos using gin(nombre gin_trgm_ops);

-- Actualizar updated_at automáticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger prospectos_updated_at
  before update on public.prospectos
  for each row execute function public.set_updated_at();

-- ─── ACTIVIDAD (log de acciones del CRM) ────────────────────
create table public.actividad (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('llamada', 'nota', 'seguimiento', 'match_aprobado')),
  prospecto_id uuid references public.prospectos(id),
  idcliente    text references public.clientes(idcliente),
  usuario_id   uuid not null references public.profiles(id),
  nota         text,
  created_at   timestamptz default now()
);

create index idx_actividad_idcliente    on public.actividad(idcliente);
create index idx_actividad_prospecto    on public.actividad(prospecto_id);
create index idx_actividad_usuario      on public.actividad(usuario_id);

-- ─── ROW LEVEL SECURITY (RLS) ───────────────────────────────
alter table public.profiles   enable row level security;
alter table public.clientes   enable row level security;
alter table public.productos  enable row level security;
alter table public.metas      enable row level security;
alter table public.facturas   enable row level security;
alter table public.visitas    enable row level security;
alter table public.prospectos enable row level security;
alter table public.actividad  enable row level security;

-- Helper: obtener rol del usuario actual
create or replace function public.get_rol()
returns text language sql security definer stable as $$
  select rol from public.profiles where id = auth.uid()
$$;

-- Helper: obtener fuerza_de_venta del usuario actual
create or replace function public.get_fuerza_de_venta()
returns text language sql security definer stable as $$
  select fuerza_de_venta from public.profiles where id = auth.uid()
$$;

-- profiles: cada uno ve el suyo; gerente y supervisor ven todos
create policy "profiles_select" on public.profiles for select using (
  id = auth.uid() or public.get_rol() in ('gerente', 'supervisor')
);
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid());

-- clientes: todos leen; vendedor solo los suyos
create policy "clientes_select_admin" on public.clientes for select using (
  public.get_rol() in ('gerente', 'supervisor')
);
create policy "clientes_select_vendedor" on public.clientes for select using (
  public.get_rol() = 'vendedor' and responsable = public.get_fuerza_de_venta()
);
create policy "clientes_insert_admin" on public.clientes for insert with check (
  public.get_rol() in ('gerente', 'supervisor')
);
create policy "clientes_update_admin" on public.clientes for update using (
  public.get_rol() in ('gerente', 'supervisor')
);

-- productos y metas: todos leen, solo admin escribe
create policy "productos_select" on public.productos for select using (auth.uid() is not null);
create policy "productos_write"  on public.productos for all using (public.get_rol() in ('gerente', 'supervisor'));
create policy "metas_select"     on public.metas for select using (auth.uid() is not null);
create policy "metas_write"      on public.metas for all using (public.get_rol() in ('gerente', 'supervisor'));

-- facturas: admin ve todo, vendedor solo las suyas
create policy "facturas_select_admin" on public.facturas for select using (
  public.get_rol() in ('gerente', 'supervisor')
);
create policy "facturas_select_vendedor" on public.facturas for select using (
  public.get_rol() = 'vendedor' and fuerza_de_venta = public.get_fuerza_de_venta()
);
create policy "facturas_insert_admin" on public.facturas for insert with check (
  public.get_rol() in ('gerente', 'supervisor')
);

-- visitas: admin ve todo, vendedor solo las suyas
create policy "visitas_select_admin" on public.visitas for select using (
  public.get_rol() in ('gerente', 'supervisor')
);
create policy "visitas_select_vendedor" on public.visitas for select using (
  public.get_rol() = 'vendedor' and fuerza_de_venta = public.get_fuerza_de_venta()
);
create policy "visitas_insert_admin" on public.visitas for insert with check (
  public.get_rol() in ('gerente', 'supervisor')
);

-- prospectos: admin ve todo, vendedor solo los suyos; supervisor puede aprobar matches
create policy "prospectos_select_admin" on public.prospectos for select using (
  public.get_rol() in ('gerente', 'supervisor')
);
create policy "prospectos_select_vendedor" on public.prospectos for select using (
  public.get_rol() = 'vendedor' and fuerza_de_venta = public.get_fuerza_de_venta()
);
create policy "prospectos_insert_admin" on public.prospectos for insert with check (
  public.get_rol() in ('gerente', 'supervisor')
);
create policy "prospectos_update_supervisor" on public.prospectos for update using (
  public.get_rol() in ('gerente', 'supervisor')
);

-- actividad: todos pueden crear, cada uno ve las suyas; admin ve todo
create policy "actividad_select_admin" on public.actividad for select using (
  public.get_rol() in ('gerente', 'supervisor')
);
create policy "actividad_select_own" on public.actividad for select using (
  usuario_id = auth.uid()
);
create policy "actividad_insert" on public.actividad for insert with check (
  auth.uid() is not null
);

-- ─── VISTA: última factura por cliente ──────────────────────
create or replace view public.clientes_ultima_factura as
select
  c.idcliente,
  c.nombre,
  c.responsable,
  c.zona,
  c.departamento,
  c.status,
  c.canal_cluster,
  f.fecha        as ultima_fecha_factura,
  f.valortotal   as ultimo_valor,
  f.pesokgrtot   as ultimo_kg,
  f.vendedor     as ultimo_vendedor,
  f.lineas       as ultima_linea,
  f.docventa     as ultimo_docventa
from public.clientes c
left join lateral (
  select fecha, valortotal, pesokgrtot, vendedor, lineas, docventa
  from public.facturas
  where idcliente = c.idcliente
    and tipodocume != 'Notas de Crédito'
    and valortotal > 0
  order by fecha desc
  limit 1
) f on true;
