import { useState, useMemo, useCallback } from 'react'
import { useProspectos, cambiarEstado, type EstadoProspecto, type ProspectoRow } from './useProspectos'

// Transiciones válidas (mismas que ProspectoDetallePage)
const TRANSICIONES: Record<EstadoProspecto, EstadoProspecto[]> = {
  nuevo:       ['seguimiento', 'perdido'],
  seguimiento: ['convertido', 'perdido'],
  convertido:  [],
  perdido:     ['nuevo'],
}

const COLUMNAS: EstadoProspecto[] = ['nuevo', 'seguimiento', 'convertido', 'perdido']

export function useKanban(filtroFuerza?: string) {
  const { prospectos, loading, error, recargar } = useProspectos('todos', filtroFuerza)
  const [moviendo, setMoviendo] = useState<string | null>(null)

  const columnas = useMemo(() => {
    const agrupado: Record<EstadoProspecto, ProspectoRow[]> = {
      nuevo: [], seguimiento: [], convertido: [], perdido: [],
    }
    for (const p of prospectos) {
      agrupado[p.estado]?.push(p)
    }
    return COLUMNAS.map(estado => ({
      estado,
      prospectos: agrupado[estado],
    }))
  }, [prospectos])

  const puedeTransicionar = useCallback(
    (desde: EstadoProspecto, hacia: EstadoProspecto) =>
      TRANSICIONES[desde]?.includes(hacia) ?? false,
    []
  )

  const moverProspecto = useCallback(
    async (prospectoId: string, nuevoEstado: EstadoProspecto) => {
      setMoviendo(prospectoId)
      const { error: err } = await cambiarEstado(prospectoId, nuevoEstado)
      setMoviendo(null)
      if (err) return { error: err }
      await recargar()
      return { error: null }
    },
    [recargar]
  )

  // Obtener fuerzas de venta únicas para el filtro
  const fuerzas = useMemo(
    () => [...new Set(prospectos.map(p => p.fuerza_de_venta))].sort(),
    [prospectos]
  )

  return {
    columnas,
    loading,
    error,
    moviendo,
    fuerzas,
    moverProspecto,
    puedeTransicionar,
    recargar,
  }
}
