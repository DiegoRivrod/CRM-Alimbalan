-- ============================================================================
-- F18: Tareas y Recordatorios
-- ============================================================================

-- Tabla de tareas
create table if not exists public.tareas (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null,
  descripcion       text,
  tipo              text not null default 'general'
                    check (tipo in ('llamada', 'visita', 'seguimiento', 'cobranza', 'general')),
  prioridad         text not null default 'media'
                    check (prioridad in ('baja', 'media', 'alta', 'urgente')),
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente', 'en_progreso', 'completada', 'cancelada')),
  fecha_vencimiento date,
  -- Relaciones
  asignado_a        uuid not null references public.profiles(id),
  creado_por        uuid not null references public.profiles(id),
  prospecto_id      uuid references public.prospectos(id),
  idcliente         text references public.clientes(idcliente),
  -- Timestamps
  completada_at     timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Índices
create index idx_tareas_asignado    on public.tareas(asignado_a);
create index idx_tareas_estado      on public.tareas(estado);
create index idx_tareas_vencimiento on public.tareas(fecha_vencimiento);
create index idx_tareas_prospecto   on public.tareas(prospecto_id);
create index idx_tareas_cliente     on public.tareas(idcliente);

-- Trigger updated_at
create trigger tareas_updated_at
  before update on public.tareas
  for each row execute function public.set_updated_at();

-- RLS
alter table public.tareas enable row level security;

-- Gerente/supervisor ven todas las tareas
create policy "tareas_select_admin" on public.tareas for select using (
  public.get_rol() in ('gerente', 'supervisor')
);

-- Vendedor ve solo las asignadas a él
create policy "tareas_select_vendedor" on public.tareas for select using (
  asignado_a = auth.uid()
);

-- Gerente/supervisor pueden crear para cualquiera
create policy "tareas_insert_admin" on public.tareas for insert with check (
  public.get_rol() in ('gerente', 'supervisor')
);

-- Vendedor puede crear solo para sí mismo
create policy "tareas_insert_vendedor" on public.tareas for insert with check (
  public.get_rol() = 'vendedor' and asignado_a = auth.uid()
);

-- Actualizar: admin cualquiera, vendedor solo las suyas
create policy "tareas_update_admin" on public.tareas for update using (
  public.get_rol() in ('gerente', 'supervisor')
);

create policy "tareas_update_vendedor" on public.tareas for update using (
  asignado_a = auth.uid()
);

-- Ampliar el CHECK de actividad para los nuevos tipos
alter table public.actividad drop constraint if exists actividad_tipo_check;
alter table public.actividad add constraint actividad_tipo_check
  check (tipo in ('llamada', 'nota', 'seguimiento', 'match_aprobado', 'tarea_creada', 'tarea_completada'));
