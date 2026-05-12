-- ─── F15: Sync automático de maestros (cron diario) ─────────────────────────
--
-- PRERREQUISITOS (habilitar en Supabase Dashboard → Database → Extensions):
--   1. pg_cron   — scheduler de tareas en PostgreSQL
--   2. pg_net    — cliente HTTP desde SQL
--
-- Una vez habilitadas las extensiones, ejecutar este script en SQL Editor.
--
-- Horario: 6:00 AM hora Perú (UTC-5) = 11:00 AM UTC  →  cron: '0 11 * * *'
-- ─────────────────────────────────────────────────────────────────────────────

-- Reemplaza <SERVICE_ROLE_KEY> con el valor real de
-- Supabase Dashboard → Settings → API → service_role key
-- (solo se guarda en la DB, no en el repo)

select cron.schedule(
  'sync-maestros-diario',           -- nombre único del job
  '0 11 * * *',                     -- cada día a las 11:00 UTC (6 AM Perú)
  $$
  select
    net.http_post(
      url     := 'https://hbxfohohfuzzihjhzhcy.supabase.co/functions/v1/sync-maestros',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := '{"tablas":["clientes","productos","metas"]}'::jsonb
    ) as request_id;
  $$
);

-- ─── Alternativa: guardar el service_role_key en app.settings ────────────────
-- Ejecutar UNA SOLA VEZ antes del cron.schedule anterior:
--
--   alter database postgres set "app.service_role_key" = '<SERVICE_ROLE_KEY>';
--
-- Esto guarda la key en la configuración de la BD (no en el código).
-- ─────────────────────────────────────────────────────────────────────────────

-- Para verificar jobs programados:
--   select * from cron.job;
--
-- Para eliminar este job si es necesario:
--   select cron.unschedule('sync-maestros-diario');
