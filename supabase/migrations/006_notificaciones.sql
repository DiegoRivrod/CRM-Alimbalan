-- ============================================================================
-- F20: Notificaciones In-App
-- ============================================================================

create table if not exists public.notificaciones (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references public.profiles(id),
  tipo            text not null check (tipo in (
    'tarea_vencida',
    'tarea_asignada',
    'prospecto_sin_actividad',
    'cliente_inactivo',
    'meta_por_cumplir',
    'importacion_completada'
  )),
  titulo          text not null,
  mensaje         text,
  leida           boolean not null default false,
  -- Referencias opcionales
  tarea_id        uuid references public.tareas(id),
  prospecto_id    uuid references public.prospectos(id),
  idcliente       text references public.clientes(idcliente),
  -- Link de navegación
  link            text,
  created_at      timestamptz default now()
);

create index idx_notificaciones_usuario on public.notificaciones(usuario_id);
create index idx_notificaciones_leida   on public.notificaciones(usuario_id, leida);
create index idx_notificaciones_fecha   on public.notificaciones(created_at desc);

-- RLS: cada usuario solo ve/actualiza las suyas
alter table public.notificaciones enable row level security;

create policy "notificaciones_select" on public.notificaciones for select using (
  usuario_id = auth.uid()
);

create policy "notificaciones_update" on public.notificaciones for update using (
  usuario_id = auth.uid()
);

create policy "notificaciones_insert" on public.notificaciones for insert with check (
  auth.uid() is not null
);

-- ── Función: generar notificaciones de tareas vencidas ───────────────────────

create or replace function public.generar_notificaciones_tareas_vencidas()
returns void language plpgsql security definer as $$
begin
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, tarea_id, link)
  select
    t.asignado_a,
    'tarea_vencida',
    'Tarea vencida: ' || t.titulo,
    'La tarea "' || t.titulo || '" venció el ' || to_char(t.fecha_vencimiento, 'DD/MM/YYYY'),
    t.id,
    '/tareas'
  from public.tareas t
  where t.estado in ('pendiente', 'en_progreso')
    and t.fecha_vencimiento < current_date
    and not exists (
      select 1 from public.notificaciones n
      where n.tarea_id = t.id
        and n.tipo = 'tarea_vencida'
        and n.created_at::date = current_date
    );
end;
$$;

-- ── Función: generar notificaciones de prospectos sin actividad (>7 días) ────

create or replace function public.generar_notificaciones_prospectos_inactivos()
returns void language plpgsql security definer as $$
begin
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, prospecto_id, link)
  select
    p2.id as usuario_id,
    'prospecto_sin_actividad',
    'Prospecto sin actividad: ' || pr.nombre,
    pr.nombre || ' lleva más de 7 días sin actividad registrada',
    pr.id,
    '/prospectos/' || pr.id
  from public.prospectos pr
  join public.profiles p2 on p2.fuerza_de_venta = pr.fuerza_de_venta
  where pr.estado in ('nuevo', 'seguimiento')
    and pr.updated_at < now() - interval '7 days'
    and not exists (
      select 1 from public.notificaciones n
      where n.prospecto_id = pr.id
        and n.tipo = 'prospecto_sin_actividad'
        and n.created_at > now() - interval '7 days'
    );
end;
$$;

-- ── Cron jobs (requiere pg_cron habilitado en Supabase) ──────────────────────
-- Descomentar si pg_cron está disponible:

-- select cron.schedule('notif-tareas-vencidas', '0 8 * * *',
--   'select public.generar_notificaciones_tareas_vencidas()');
-- select cron.schedule('notif-prospectos-inactivos', '0 8 * * 1',
--   'select public.generar_notificaciones_prospectos_inactivos()');
