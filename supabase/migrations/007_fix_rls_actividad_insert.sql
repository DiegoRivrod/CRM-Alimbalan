-- 007_fix_rls_actividad_insert.sql
-- Endurece la policy de INSERT en `actividad`: impide que un usuario
-- inserte registros suplantando a otro mediante un usuario_id distinto al suyo.
--
-- Antes:  with check (auth.uid() is not null)
-- Ahora:  with check (usuario_id = auth.uid())
--
-- Aplicar en Supabase Dashboard → SQL Editor (o vía supabase db push).

drop policy if exists "actividad_insert" on public.actividad;

create policy "actividad_insert" on public.actividad for insert with check (
  usuario_id = auth.uid()
);
