/**
 * Edge Function: sync-visitas
 * Recibe el CSV de visitas de Google Forms (ya descargado),
 * normaliza de formato ancho (001/002/003/004) a largo (1 fila por visita),
 * inserta en la tabla visitas y crea prospectos para clientes nuevos.
 *
 * POST /functions/v1/sync-visitas
 * Body: FormData con campo "file" (CSV)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface VisitaNormalizada {
  marca_temporal:          string
  fuerza_de_venta:         string
  localizacion:            string | null
  latitud:                 number | null
  longitud:                number | null
  numero_visita:           number
  es_cliente_nuevo:        boolean
  idcliente:               string | null
  nombre_cliente_nuevo:    string | null
  contacto:                string | null
  zona:                    string | null
  tipo_cliente:            string | null
  especie:                 string | null
  animales:                number | null
  granjas:                 number | null
  procedencia:             string | null
  problema_abastecimiento: string | null
  lineas_productos:        string | null
  potencial_consumo_tn:    number | null
  marcas_consume:          string | null
}

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


function parseLatLng(loc: string): [number | null, number | null] {
  const parts = loc.split(',').map(p => parseFloat(p.trim()))
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return [parts[0], parts[1]]
  return [null, null]
}

function normalizarVisitas(
  headers: string[],
  rows: string[][],
): VisitaNormalizada[] {
  const PREFIJOS = ['001', '002', '003', '004']
  const result: VisitaNormalizada[] = []

  const idxOf = (h: string) => headers.findIndex(x => x === h)

  for (const row of rows) {
    const get = (h: string) => row[idxOf(h)] ?? ''

    const marcaTemporal = get('Marca temporal')
    const fuerzaDeVenta = get('SELECCIONE LA FUERZA DE VENTAS')
    const locRaw        = get('Localización')
    const localizacion  = locRaw || null
    const [latitud, longitud] = localizacion ? parseLatLng(localizacion) : [null, null]

    for (const p of PREFIJOS) {
      const esNuevoRaw = get(`${p}. ¿El Cliente a visitar es nuevo?`)
      if (!esNuevoRaw) continue

      const esClienteNuevo     = esNuevoRaw.toLowerCase() === 'si'
      const clienteSeleccionado = get(`${p}. SELECCIONE EL CLIENTE`) || null
      const nombreNuevo        = get(`${p}. REGISTRE EL NOMBRE DEL CLIENTE NUEVO`) || null

      if (!clienteSeleccionado && !nombreNuevo) continue

      const potencialRaw = get(`${p}. Por favor, indique el potencial de consumo del cliente en toneladas (TN), entendiendo este como el volumen aproximado que podría llegar a adquirir de nuestra parte.  `)
      const potencial    = potencialRaw ? Number(potencialRaw) : null

      result.push({
        marca_temporal:          marcaTemporal,
        fuerza_de_venta:         fuerzaDeVenta,
        localizacion,
        latitud,
        longitud,
        numero_visita:           Number(p),
        es_cliente_nuevo:        esClienteNuevo,
        idcliente:               !esClienteNuevo ? clienteSeleccionado : null,
        nombre_cliente_nuevo:    esClienteNuevo ? (nombreNuevo ?? clienteSeleccionado) : null,
        contacto:                get(`${p}. Ingrese el número de contacto del nuevo cliente`) || null,
        zona:                    get(`${p}. ¿A qué zona pertenece el cliente?`) || null,
        tipo_cliente:            get(`${p}. Seleccione el tipo de cliente`) || null,
        especie:                 get(`${p}. ¿Qué especie cría actualmente el cliente?`) || null,
        animales:                get(`${p}. Indique cuántos animales está criando actualmente.`) ? Number(get(`${p}. Indique cuántos animales está criando actualmente.`)) : null,
        granjas:                 get(`${p}. Indique cuántas granjas/establos/galones tiene el cliente actualmente.`) ? Number(get(`${p}. Indique cuántas granjas/establos/galones tiene el cliente actualmente.`)) : null,
        procedencia:             get(`${p}. Por favor, indique la procedencia o el lugar de adquisición de los animales destinados a la crianza por parte del cliente.`) || null,
        problema_abastecimiento: get(`${p}. ¿El cliente presenta problemas de abastecimiento para sus animales? Por favor, detallar.`) || null,
        lineas_productos:        get(`${p}. ¿Qué líneas de productos comercializa actualmente el cliente ?`) || null,
        potencial_consumo_tn:    isNaN(potencial as number) ? null : potencial,
        marcas_consume:          get(`${p}. ¿Qué marcas de alimento consume/vende actualmente el cliente? `) || null,
      })
    }
  }

  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Leer CSV del body
  const text = await req.text()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) {
    return new Response(JSON.stringify({ error: 'CSV vacío' }), { status: 400 })
  }

  const headers = parseCSVLine(lines[0])
  const rows    = lines.slice(1).map(parseCSVLine)
  const visitas = normalizarVisitas(headers, rows)

  // Upsert visitas
  const CHUNK = 200
  let totalVisitas = 0
  for (let i = 0; i < visitas.length; i += CHUNK) {
    const { error } = await supabase
      .from('visitas')
      .upsert(visitas.slice(i, i + CHUNK), { onConflict: 'marca_temporal,fuerza_de_venta,numero_visita' })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    totalVisitas += Math.min(CHUNK, visitas.length - i)
  }

  // Crear prospectos para clientes nuevos
  const nuevos = visitas.filter(v => v.es_cliente_nuevo && v.nombre_cliente_nuevo)
  let totalProspectos = 0
  if (nuevos.length) {
    const prospectos = nuevos.map(v => ({
      nombre:          v.nombre_cliente_nuevo!,
      contacto:        v.contacto,
      fuerza_de_venta: v.fuerza_de_venta,
      zona:            v.zona,
      especie:         v.especie,
      potencial_tn:    v.potencial_consumo_tn,
      marcas_consume:  v.marcas_consume,
      estado:          'nuevo',
    }))
    const { error } = await supabase
      .from('prospectos')
      .upsert(prospectos, { onConflict: 'nombre,fuerza_de_venta' })
    if (!error) totalProspectos = prospectos.length
  }

  return new Response(
    JSON.stringify({ ok: true, visitas: totalVisitas, prospectos: totalProspectos }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
  )
})
