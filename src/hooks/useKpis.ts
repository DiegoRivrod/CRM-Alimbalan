import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const SEMANAS = ['SEMANA 1', 'SEMANA 2', 'SEMANA 3', 'SEMANA 4'] as const

export interface ClienteInactivo {
  idcliente: string
  nombre: string
  responsable: string | null
  ultima_fecha_factura: string | null
  dias_sin_compra: number | null
}

export interface SemanaVentas {
  label: string
  ventas: number
}

export interface SemanaComparativa {
  porSemana: SemanaVentas[]
  semanaCalendario: string | null
  semanaAnterior: string | null
  ventasSemanaCalendario: number
  ventasSemanaAnterior: number
  pctCambioSemanal: number | null
  esMesSeleccionadoIgualCalendario: boolean
}

function diasEntre(isoDate: string, hasta: Date): number {
  const d = new Date(isoDate + 'T12:00:00')
  const t = new Date(hasta)
  t.setHours(12, 0, 0, 0)
  return Math.floor((t.getTime() - d.getTime()) / 86_400_000)
}

/** Misma regla que ETL: días 1–8=S1 … 23–30=S4 */
export function semanaDelMesPorDia(day: number): string {
  if (day <= 8) return 'SEMANA 1'
  if (day <= 15) return 'SEMANA 2'
  if (day <= 22) return 'SEMANA 3'
  return 'SEMANA 4'
}

function semanaPrevia(label: string): string | null {
  const m: Record<string, string | null> = {
    'SEMANA 4': 'SEMANA 3',
    'SEMANA 3': 'SEMANA 2',
    'SEMANA 2': 'SEMANA 1',
    'SEMANA 1': null,
  }
  return m[label] ?? null
}

export function useKpisExtras(mes: string, anio: number, diasInactivos: number) {
  const [clientesInactivos, setClientesInactivos] = useState<ClienteInactivo[]>([])
  const [prospectosAbiertos, setProspectosAbiertos] = useState<number>(0)
  const [semanaStats, setSemanaStats] = useState<SemanaComparativa | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const hoy = new Date()
      const mesCal = mes.toUpperCase()
      const mesesIdx = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
      ]
      const idxMesSel = mesesIdx.indexOf(mesCal)
      const esMesActual =
        anio === hoy.getFullYear() && idxMesSel === hoy.getMonth()

      try {
        const { data: rawView, error: vErr } = await supabase
          .from('clientes_ultima_factura')
          .select('idcliente,nombre,responsable,ultima_fecha_factura')

        if (vErr) {
          setError(vErr.message)
          setLoading(false)
          return
        }

        const rows = (rawView ?? []) as Array<{
          idcliente: string
          nombre: string | null
          responsable: string | null
          ultima_fecha_factura: string | null
        }>

        const inactivos: ClienteInactivo[] = []
        for (const r of rows) {
          const ult = r.ultima_fecha_factura
          let dias: number | null = null
          if (ult) dias = diasEntre(ult, hoy)
          const sinCompra = ult == null || (dias !== null && dias > diasInactivos)
          if (sinCompra) {
            inactivos.push({
              idcliente: r.idcliente,
              nombre: r.nombre ?? r.idcliente,
              responsable: r.responsable,
              ultima_fecha_factura: ult,
              dias_sin_compra: ult ? dias : null,
            })
          }
        }
        inactivos.sort((a, b) => {
          const da = a.dias_sin_compra ?? 99999
          const db = b.dias_sin_compra ?? 99999
          return db - da
        })
        setClientesInactivos(inactivos.slice(0, 80))

        const { count: pc, error: pErr } = await supabase
          .from('prospectos')
          .select('id', { count: 'exact', head: true })
          .in('estado', ['nuevo', 'seguimiento'])

        if (pErr) {
          setError(pErr.message)
          setLoading(false)
          return
        }
        setProspectosAbiertos(pc ?? 0)

        let q = supabase
          .from('facturas')
          .select('semana,valortotal,mes,anio')
          .neq('tipodocume', 'Notas de Crédito')
          .gt('valortotal', 0)
          .eq('mes', mesCal)
          .eq('anio', anio)

        const { data: rawF, error: fErr } = await q
        if (fErr) {
          setError(fErr.message)
          setLoading(false)
          return
        }

        const facturas = (rawF ?? []) as Array<{
          semana: string | null
          valortotal: number | null
        }>

        const agg = new Map<string, number>()
        for (const s of SEMANAS) agg.set(s, 0)
        for (const f of facturas) {
          const lab = f.semana?.trim()
          if (!lab || !agg.has(lab)) continue
          agg.set(lab, (agg.get(lab) ?? 0) + (f.valortotal ?? 0))
        }

        const porSemana: SemanaVentas[] = SEMANAS.map((label) => ({
          label,
          ventas: Math.round(agg.get(label) ?? 0),
        }))

        let semanaCal: string | null = null
        let semanaAnt: string | null = null
        let vCal = 0
        let vAnt = 0
        let pct: number | null = null

        if (esMesActual) {
          semanaCal = semanaDelMesPorDia(hoy.getDate())
          semanaAnt = semanaPrevia(semanaCal)
          vCal = agg.get(semanaCal) ?? 0
          vAnt = semanaAnt ? (agg.get(semanaAnt) ?? 0) : 0
          if (semanaAnt && vAnt > 0) pct = Math.round(((vCal - vAnt) / vAnt) * 100)
          else if (semanaAnt && vAnt === 0 && vCal > 0) pct = 100
          else pct = null
        }

        setSemanaStats({
          porSemana,
          semanaCalendario: semanaCal,
          semanaAnterior: semanaAnt,
          ventasSemanaCalendario: Math.round(vCal),
          ventasSemanaAnterior: Math.round(vAnt),
          pctCambioSemanal: pct,
          esMesSeleccionadoIgualCalendario: esMesActual,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar KPIs')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [mes, anio, diasInactivos])

  return {
    clientesInactivos,
    prospectosAbiertos,
    semanaStats,
    loading,
    error,
  }
}
