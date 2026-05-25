/**
 * Cliente Google Sheets — lectura de maestros via URL pública CSV
 *
 * Los Google Sheets de maestros son accesibles como CSV público mediante:
 *   https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&sheet={NOMBRE}
 *
 * Para las visitas el CSV se sube directamente (descargado desde Google Sheets).
 */

import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { Cliente, Producto, Meta } from '@/types/supabase'
import { normalizarVisitas, type VisitaRaw, type VisitaNormalizada } from './etl'

// ─── IDs de los Google Sheets (del CLAUDE.md del proyecto) ──────────────────
const SHEET_IDS = {
  clientes:  '179agEPXpVq0V4qHqmyGWzhtBRbJO-ZEh4WlQi0el6s0',
  productos: '1r3Tow469UzhczgI3VQi3AkJjTAZoGefFZ8Mc3mf5x4I',
  metas:     '1x81BG7b2Ap-gvYDFwQTY7_zjBCtaa5STGsTDWJYM_sg',
} as const

function csvUrl(sheetId: string, sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
}

async function fetchCSV(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Error al leer Google Sheets: ${res.status} ${res.statusText}`)
  const text = await res.text()

  // Parsear CSV con xlsx (maneja comillas, saltos de línea en celdas, etc.)
  const wb = XLSX.read(text, { type: 'string' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
}

function s(v: unknown): string  { return v == null ? '' : String(v).trim() }
function n(v: unknown): number | null {
  if (v == null || s(v) === '') return null
  const num = Number(String(v).replace(/,/g, ''))
  return isNaN(num) ? null : num
}

// ─── Clientes ────────────────────────────────────────────────────────────────

export async function fetchClientes(): Promise<Omit<Cliente, 'updated_at'>[]> {
  const rows = await fetchCSV(csvUrl(SHEET_IDS.clientes, 'Clientes'))
  return rows
    .filter(r => s(r['IDCLIENTE']) !== '')
    .map(r => ({
      idcliente:          s(r['IDCLIENTE']).padStart(6, '0'),
      razon_sg:           s(r['RAZON S.G'])            || null,
      id_razon:           s(r['ID RAZON'])              || null,
      nombre:             s(r['NOMBRE'])                || s(r['RAZON S.G']),
      responsable:        s(r['RESPONSABLE'])           || null,
      zona:               s(r['ZONA'])                  || null,
      departamento:       s(r['DEPARTAMENTO'])          || null,
      provincia:          s(r['PROVINCIA'])             || null,
      distrito:           s(r['DISTRITO'])              || null,
      vendedor:           s(r['VENDEDOR'])              || null,
      localizacion:       s(r['LOCALIZACIÓN'])          || null,
      lista_precios:      s(r['LISTA DE PRECIOS'])      || null,
      canal_cluster:      s(r['CANAL CLUSTER'])         || null,
      top:                s(r['TOP'])                   || null,
      status:             s(r['STATUS'])                || 'ACTIVO',
      cod:                s(r['COD'])                   || null,
      meta_departamento:  n(r['META DEPARTAMENTO']),
      meta_top:           n(r['META TOP']),
      meta_canal_cluster: n(r['META CANAL CLUSTER']),
      canal_truchas:      s(r['CANAL TRUCHAS'])         || null,
      meta_truchas_puno:  n(r['META TRUCHAS PUNO']),
      meta_semana_1:      n(r['META SEMANA 1']),
      meta_semana_2:      n(r['META SEMANA 2']),
      meta_semana_3:      n(r['META SEMANA 3']),
      meta_semana_4:      n(r['META SEMANA 4']),
    }))
}

// ─── Productos ───────────────────────────────────────────────────────────────

export async function fetchProductos(): Promise<Omit<Producto, 'updated_at'>[]> {
  const rows = await fetchCSV(csvUrl(SHEET_IDS.productos, 'Productos'))
  return rows
    .filter(r => s(r['IDARTICULO']) !== '')
    .map(r => ({
      idarticulo:   s(r['IDARTICULO']),
      descripcio:   s(r['DESCRIPCIO']),
      lineas:       s(r['LINEAS ']) || s(r['LINEAS']) || null,
      marca:        s(r['MARCA'])   || null,
      presentacion: s(r['PRESENTACION']) || null,
      peso_saco:    n(r['PESO SACO']) != null ? Math.round(n(r['PESO SACO'])!) : null,
      tipo:         s(r['TIPO ']) || s(r['TIPO']) || null,
      meta:         n(r['META'])  != null ? Math.round(n(r['META'])!)  : null,
    }))
}

// ─── Metas ───────────────────────────────────────────────────────────────────

export async function fetchMetas(): Promise<Omit<Meta, 'updated_at'>[]> {
  const rows = await fetchCSV(csvUrl(SHEET_IDS.metas, 'Pelletizado'))
  return rows
    .filter(r => s(r['COD']) !== '')
    .map(r => ({
      cod:           s(r['COD']),
      zona_de_venta: s(r['Zona de Venta']),
      meta:          Math.round(n(r['META']) ?? 0),
    }))
}

// ─── Visitas (CSV subido manualmente) ────────────────────────────────────────

export async function parseVisitasCSV(file: File): Promise<VisitaNormalizada[]> {
  // Papa Parse maneja UTF-8 correctamente y no intenta interpretar fechas como
  // serial de Excel (a diferencia de XLSX.read, que rompía los headers con `¿`
  // y devolvía fechas heterogéneas).
  const text = await file.text()
  const result = Papa.parse<VisitaRaw>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  return normalizarVisitas(result.data)
}
