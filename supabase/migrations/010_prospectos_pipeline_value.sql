-- Migración 010: Valor económico en oportunidades del pipeline
-- Permite calcular el valor total del pipeline y el revenue ponderado por etapa

ALTER TABLE public.prospectos
  ADD COLUMN IF NOT EXISTS monto_estimado  NUMERIC(12,2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS probabilidad_cierre SMALLINT DEFAULT 20 NOT NULL,
  ADD COLUMN IF NOT EXISTS razon_perdida   TEXT;

-- Probabilidad por defecto según etapa:
-- nuevo: 20%, seguimiento: 50%, convertido: 100%, perdido: 0%
-- El usuario puede sobreescribir el valor manualmente.

COMMENT ON COLUMN public.prospectos.monto_estimado    IS 'Valor económico estimado de la oportunidad en soles (S/)';
COMMENT ON COLUMN public.prospectos.probabilidad_cierre IS 'Probabilidad de cierre 0-100 (%). Default según etapa: nuevo=20, seguimiento=50';
COMMENT ON COLUMN public.prospectos.razon_perdida      IS 'Motivo de pérdida: precio | competencia | timing | sin_respuesta | otro';
