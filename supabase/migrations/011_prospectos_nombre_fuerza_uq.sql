-- 011_prospectos_nombre_fuerza_uq.sql
-- El upsert de prospectos desde la importación de visitas necesita un constraint UNIQUE
-- en (nombre, fuerza_de_venta) para que ON CONFLICT funcione correctamente.
ALTER TABLE public.prospectos
  ADD CONSTRAINT prospectos_nombre_fuerza_uq UNIQUE (nombre, fuerza_de_venta);
