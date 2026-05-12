/**
 * Edge Function: sync-maestros
 * Lee Clientes, Productos y Metas desde Google Sheets y hace upsert en Supabase.
 * Se puede invocar vía POST desde el frontend o en un cron job.
 *
 * POST /functions/v1/sync-maestros
 * Body: { "tablas": ["clientes","productos","metas"] }  (opcional — por defecto sincroniza todo)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SHEET_IDS = {
  clientes:  '179agEPXpVq0V4qHqmyGWzhtBRbJO-ZEh4WlQi0el6s0',
  productos: '1r3Tow469UzhczgI3VQi3AkJjTAZoGefFZ8Mc3mf5x4I',
  metas:     '1x81BG7b2Ap-gvYDFwQTY7_zjBCtaa5STGsTDWJYM_sg',
}

function csvUrl(id: string, sheet: string) {
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`
}

async function fetchCSV(url: string): Promise<Record<string, string>[]> {
  const res  = await fetch(url)
  const text = await res.text()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
}

// CSV parser simple (maneja campos con comillas)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function s(v: string | undefined): string | null { return v?.trim() || null }
function n(v: string | undefined): number | null {
  if (!v?.trim()) return null
  const num = Number(v.replace(/,/g, ''))
  return isNaN(num) ? null : num
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const tablas: string[] = body.tablas ?? ['clientes', 'productos', 'metas']

  const resultado: Record<string, unknown> = {}

  // ── Clientes ──────────────────────────────────────────────────────────────
  if (tablas.includes('clientes')) {
    const rows = await fetchCSV(csvUrl(SHEET_IDS.clientes, 'Clientes'))
    const data = rows
      .filter(r => r['IDCLIENTE']?.trim())
      .map(r => ({
        idcliente:          String(r['IDCLIENTE']).padStart(6, '0'),
        razon_sg:           s(r['RAZON S.G']),
        id_razon:           s(r['ID RAZON']),
        nombre:             s(r['NOMBRE']) ?? s(r['RAZON S.G']) ?? '',
        responsable:        s(r['RESPONSABLE']),
        zona:               s(r['ZONA']),
        departamento:       s(r['DEPARTAMENTO']),
        provincia:          s(r['PROVINCIA']),
        distrito:           s(r['DISTRITO']),
        vendedor:           s(r['VENDEDOR']),
        localizacion:       s(r['LOCALIZACIÓN']),
        lista_precios:      s(r['LISTA DE PRECIOS']),
        canal_cluster:      s(r['CANAL CLUSTER']),
        top:                s(r['TOP']),
        status:             s(r['STATUS']) ?? 'ACTIVO',
        cod:                s(r['COD']),
        meta_departamento:  n(r['META DEPARTAMENTO']),
        meta_top:           n(r['META TOP']),
        meta_canal_cluster: n(r['META CANAL CLUSTER']),
        canal_truchas:      s(r['CANAL TRUCHAS']),
        meta_truchas_puno:  n(r['META TRUCHAS PUNO']),
        meta_semana_1:      n(r['META SEMANA 1']),
        meta_semana_2:      n(r['META SEMANA 2']),
        meta_semana_3:      n(r['META SEMANA 3']),
        meta_semana_4:      n(r['META SEMANA 4']),
      }))

    const { error } = await supabase.from('clientes').upsert(data, { onConflict: 'idcliente' })
    resultado.clientes = error ? { error: error.message } : { count: data.length }
  }

  // ── Productos ─────────────────────────────────────────────────────────────
  if (tablas.includes('productos')) {
    const rows = await fetchCSV(csvUrl(SHEET_IDS.productos, 'Productos'))
    const data = rows
      .filter(r => r['IDARTICULO']?.trim())
      .map(r => ({
        idarticulo:   r['IDARTICULO'].trim(),
        descripcio:   s(r['DESCRIPCIO']) ?? '',
        lineas:       s(r['LINEAS ']) ?? s(r['LINEAS']),
        marca:        s(r['MARCA']),
        presentacion: s(r['PRESENTACION']),
        peso_saco:    n(r['PESO SACO']) != null ? Math.round(n(r['PESO SACO'])!) : null,
        tipo:         s(r['TIPO ']) ?? s(r['TIPO']),
        meta:         n(r['META']) != null ? Math.round(n(r['META'])!) : null,
      }))

    const { error } = await supabase.from('productos').upsert(data, { onConflict: 'idarticulo' })
    resultado.productos = error ? { error: error.message } : { count: data.length }
  }

  // ── Metas ─────────────────────────────────────────────────────────────────
  if (tablas.includes('metas')) {
    const rows = await fetchCSV(csvUrl(SHEET_IDS.metas, 'Pelletizado'))
    const data = rows
      .filter(r => r['COD']?.trim())
      .map(r => ({
        cod:           r['COD'].trim(),
        zona_de_venta: s(r['Zona de Venta']) ?? '',
        meta:          Math.round(n(r['META']) ?? 0),
      }))

    const { error } = await supabase.from('metas').upsert(data, { onConflict: 'cod' })
    resultado.metas = error ? { error: error.message } : { count: data.length }
  }

  // Registrar en importaciones (para el historial de la UI)
  const totalFilas = Object.values(resultado).reduce((s, r) => {
    const rr = r as { count?: number }
    return s + (rr?.count ?? 0)
  }, 0)

  // Usamos un usuario_id de sistema (nil UUID) para diferenciar syncs automáticos
  const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'
  await supabase.from('importaciones').insert({
    tipo:             'maestros',
    mes_importacion:  null,
    filas_procesadas: totalFilas,
    filas_omitidas:   0,
    prospectos_conv:  0,
    usuario_id:       SYSTEM_USER_ID,
  })

  return new Response(JSON.stringify({ ok: true, resultado }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
})
