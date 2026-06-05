-- 012_visitas_update_policy.sql
-- El upsert de visitas (importación) falla en re-importaciones porque no existía
-- política UPDATE. Sin ella, el ON CONFLICT DO UPDATE es bloqueado por RLS.
create policy "visitas_update_admin" on public.visitas for update using (
  public.get_rol() in ('gerente', 'supervisor')
);
