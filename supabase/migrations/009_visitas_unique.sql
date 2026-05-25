-- 009_visitas_unique.sql
-- Agrega UNIQUE constraint a visitas para que el upsert idempotente del ETL funcione.
-- El código en ImportarPage hace upsert con onConflict='marca_temporal,fuerza_de_venta,numero_visita',
-- pero la migración original (001) solo definió un CHECK constraint, no UNIQUE.
-- Sin esto Postgres rechaza el upsert con "there is no unique or exclusion constraint matching".

alter table public.visitas
  add constraint visitas_unica unique (marca_temporal, fuerza_de_venta, numero_visita);
