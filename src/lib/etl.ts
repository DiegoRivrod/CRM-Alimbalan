/**
 * ETL — Réplica TypeScript del script Python (script ventas dec.ipynb)
 * Procesa el Excel de facturas del ERP y devuelve filas listas para insertar en Supabase.
 *
 * Flujo:
 *   FACTURAS (Excel) + Productos (Supabase) + Clientes (Supabase) + Metas (Supabase)
 *   → join → limpiar → calcular semana/mes → reasignar fuerza_de_venta → output
 */

import * as XLSX from 'xlsx'
import type { Cliente, Producto, Meta, Factura } from '@/types/supabase'

// ─── Tipos intermedios ──────────────────────────────────────────────────────

interface RawFacturaRow {
  TIPODOCUME: string
  IDSERIE: string
  NUMERO: string | number
  FECHA: string
  DESCONDICI?: string
  IDCLIENTE: string | number
  NOMBRE: string
  IDARTICULO: string | number
  DESCRIPCIO?: string
  CANTIDAD?: number
  PESOKGR?: number
  TOTAL?: number
  VENDEDOR?: string
  [key: string]: unknown
}

export type FacturaInsert = Omit<Factura, 'id' | 'created_at' | 'docventa'>

export interface ETLResult {
  rows: FacturaInsert[]
  skipped: number
  errors: string[]
  skipDetail: {
    clienteVarios: number
    valorCero: number
    sinProducto: number
    duplicados: number
    otrosErrores: number
  }
}

// ─── Diccionario de reasignación COD META → (departamento, fuerza_de_venta) ─

const DICT_COD_META: Record<string, [string, string]> = {
  'ASESORA COMERCIAL 1-ArequipaCaylloma':              ['Arequipa',      'ASESORA COMERCIAL 1'],
  'ASESORA COMERCIAL 2-Apurimac':                      ['Apurimac',      'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 1-ArequipaArequipa':              ['Arequipa',      'ASESORA COMERCIAL 1'],
  'ASESORA COMERCIAL 2-CuscoOtros':                    ['Cusco',         'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 1-ArequipaCamana':                ['Arequipa',      'ASESORA COMERCIAL 1'],
  'ASESORA COMERCIAL 1-ArequipaCastilla':              ['Arequipa',      'ASESORA COMERCIAL 1'],
  'ASESORA COMERCIAL 1-MoqueguaIlo':                   ['Moquegua',      'ASESORA COMERCIAL 1'],
  'ASESORA COMERCIAL 1-ArequipaSanta Rita de Siguas':  ['Arequipa',      'ASESORA COMERCIAL 1'],
  'ASESORA COMERCIAL 1-MoqueguaMariscal Nieto':        ['Moquegua',      'ASESORA COMERCIAL 1'],
  'ASESORA COMERCIAL 1-CuscoLa Convencion':            ['Cusco',         'ASESORA COMERCIAL 1'],
  'ASESORA COMERCIAL 2-PunoAzangaro':                  ['Puno',          'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-CuscoCalca':                    ['Cusco',         'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-CuscoCanchis':                  ['Cusco',         'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-PunoOtros':                     ['Puno',          'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-ArequipaCastilla':              ['Arequipa',      'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-ArequipaCaylloma':              ['Arequipa',      'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-ArequipaArequipa':              ['Arequipa',      'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-ArequipaChachas':               ['Arequipa',      'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-ArequipaCondesuyo':             ['Arequipa',      'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-CuscoCusco':                    ['Cusco',         'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-CuscoEspinar':                  ['Cusco',         'ASESORA COMERCIAL 2'],
  'VENDEDOR DE COBERTURA SUR CHICO-Lima':              ['Lima',          'VENDEDOR DE COBERTURA SUR CHICO'],
  'VENDEDOR DE COBERTURA SUR CHICO-IcaNazca':          ['Ica',           'VENDEDOR DE COBERTURA SUR CHICO'],
  'VENDEDOR DE COBERTURA SUR CHICO-Arequipa':          ['Arequipa',      'VENDEDOR DE COBERTURA SUR CHICO'],
  'VENDEDOR DE COBERTURA SUR CHICO-IcaOtros':          ['Ica',           'VENDEDOR DE COBERTURA SUR CHICO'],
  'VENDEDOR DE COBERTURA SUR CHICO-Ica':               ['Ica',           'VENDEDOR DE COBERTURA SUR CHICO'],
  'ASESORA COMERCIAL 2-Junin':                         ['Junin',         'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-ArequipaIslay':                 ['Arequipa',      'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-TacnaJorgeBasadre':             ['Tacna',         'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-TacnaIte':                      ['Tacna',         'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-TacnaNuevaFrontera':            ['Tacna',         'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-ArequipaLa Union':              ['Arequipa',      'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-Madre De DiosManu':             ['Madre De Dios', 'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-MoqueguaMariscal Nieto':        ['Moquegua',      'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-PunoMelgar':                    ['Puno',          'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-ArequipaOrcopampa':             ['Arequipa',      'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-ArequipaPampacolca':            ['Arequipa',      'ASESORA COMERCIAL 2'],
  'ROGELIO MEJIA-LimaHuara':                           ['Lima',          'ROGELIO MEJIA'],
  'ASESORA COMERCIAL 1-ArequipaCondesuyos':            ['Arequipa',      'ASESORA COMERCIAL 1'],
  'ASESORA COMERCIAL 2-CuscoQuispicanchis':            ['Cusco',         'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-PunoSan Roman':                 ['Puno',          'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 2-Madre De DiosTambopata':        ['Madre De Dios', 'ASESORA COMERCIAL 2'],
  'VENDEDOR TÉCNICO AREQUIPA-ArequipaCONO':            ['Arequipa',      'VENDEDOR TÉCNICO AREQUIPA'],
  'VENDEDOR TÉCNICO AREQUIPA-ArequipaCURAL':           ['Arequipa',      'VENDEDOR TÉCNICO AREQUIPA'],
  'VENDEDOR TÉCNICO AREQUIPA-ArequipaAVELINO':         ['Arequipa',      'VENDEDOR TÉCNICO AREQUIPA'],
  'VENDEDOR TÉCNICO AREQUIPA-ArequipaSANB':            ['Arequipa',      'VENDEDOR TÉCNICO AREQUIPA'],
  'VENDEDOR TÉCNICO AREQUIPA-ArequipaCONV':            ['Arequipa',      'VENDEDOR TÉCNICO AREQUIPA'],
  'VENDEDOR TECNICO LA JOYA-ArequipaLA JOYA':          ['Arequipa',      'VENDEDOR TECNICO LA JOYA'],
  'VENDEDOR TECNICO LA JOYA-ArequipaLA ESCONDIDA':     ['Arequipa',      'VENDEDOR TECNICO LA JOYA'],
  'VENDEDOR TECNICO LA JOYA-ArequipaEL CRUCE':         ['Arequipa',      'VENDEDOR TECNICO LA JOYA'],
  'VENDEDOR TECNICO LA JOYA-ArequipaSAN JOSE':         ['Arequipa',      'VENDEDOR TECNICO LA JOYA'],
  'VENDEDOR TECNICO LA JOYA-ArequipaSAN CAMILO':       ['Arequipa',      'VENDEDOR TECNICO LA JOYA'],
  'VENDEDOR TECNICO LA JOYA-ArequipaEL RAMAL':         ['Arequipa',      'VENDEDOR TECNICO LA JOYA'],
  'VENDEDOR TECNICO LA JOYA-ArequipaLA CANO':          ['Arequipa',      'VENDEDOR TECNICO LA JOYA'],
  'VENDEDOR TECNICO LA JOYA-ArequipaSAN ISIDRO':       ['Arequipa',      'VENDEDOR TECNICO LA JOYA'],
  'VENDEDOR TECNICO LA JOYA-ArequipaPALCA':            ['Arequipa',      'VENDEDOR TECNICO LA JOYA'],
  'VENDEDOR TÉCNICO PEDREGAL-ArequipaCaylloma':        ['Arequipa',      'VENDEDOR TÉCNICO PEDREGAL'],
  'VENDEDOR TÉCNICO PEDREGAL-ArequipaPaucarpata':      ['Arequipa',      'VENDEDOR TÉCNICO PEDREGAL'],
  'VENDEDOR TÉCNICO PEDREGAL-ArequipaCamana':          ['Arequipa',      'VENDEDOR TÉCNICO PEDREGAL'],
  'VENDEDOR TÉCNICO PEDREGAL-ArequipaAplao':           ['Arequipa',      'VENDEDOR TÉCNICO PEDREGAL'],
  'ASESORA COMERCIAL 1-ArequipaExtrusion':             ['Arequipa',      'ASESORA COMERCIAL 1'],
  'VENDEDOR ZONA PUNO-Puno':                           ['Puno',          'VENDEDOR ZONA PUNO'],
  'ASESORA COMERCIAL 2-AyacuchoAyacucho':              ['Ayacucho',      'ASESORA COMERCIAL 2'],
  'ASESORA COMERCIAL 1-AyacuchoHuamanga':              ['Ayacucho',      'ASESORA COMERCIAL 1'],
  'ASESORA COMERCIAL 1-Ayacucho':                      ['Ayacucho',      'ASESORA COMERCIAL 1'],
  'ASESORA COMERCIAL 1-AyacuchoVRAEM':                 ['Ayacucho',      'ASESORA COMERCIAL 1'],
  'VENDEDOR CUSCO 1-CuscoUrubamba':                    ['Cusco',         'VENDEDOR CUSCO 1'],
  'VENDEDOR CUSCO 2-ApurimacAbancay':                  ['Cusco',         'VENDEDOR CUSCO 2'],
  'VENDEDOR CUSCO 2-AyacuchoAyacucho':                 ['Cusco',         'VENDEDOR CUSCO 2'],
  'VENDEDOR CUSCO 2-ApurimacAndahuaylas':              ['Cusco',         'VENDEDOR CUSCO 2'],
  'VENDEDOR CUSCO 2-AyacuchoHuamanga':                 ['Cusco',         'VENDEDOR CUSCO 2'],
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convierte número de serie de Excel a fecha JS */
function excelDateToJS(serial: number): Date {
  const utc_days  = Math.floor(serial - 25569)
  const utc_value = utc_days * 86400
  return new Date(utc_value * 1000)
}

function parseDate(value: unknown): Date | null {
  if (!value) return null
  if (typeof value === 'number') return excelDateToJS(value)
  const d = new Date(String(value))
  return isNaN(d.getTime()) ? null : d
}

function calcSemana(day: number): string {
  if (day >= 1  && day <= 8)  return 'SEMANA 1'
  if (day >= 9  && day <= 15) return 'SEMANA 2'
  if (day >= 16 && day <= 22) return 'SEMANA 3'
  if (day >= 23 && day <= 30) return 'SEMANA 4'
  return 'SEMANA 4'
}

const MESES = [
  'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'
]

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

// ─── Función principal ──────────────────────────────────────────────────────

/**
 * Procesa un archivo Excel de facturas y devuelve las filas listas para Supabase.
 * @param file         Archivo .xlsx subido por el usuario
 * @param clientes     Filas de la tabla clientes (cargadas desde Supabase)
 * @param productos    Filas de la tabla productos (cargadas desde Supabase)
 * @param metas        Filas de la tabla metas (cargadas desde Supabase)
 * @param mesImportacion  Etiqueta ej. "ABRIL_2026"
 */
export async function procesarFacturasExcel(
  file: File,
  clientes: Cliente[],
  productos: Producto[],
  _metas: Meta[],
  mesImportacion: string,
): Promise<ETLResult> {

  // 1. Leer el archivo (Excel o CSV con separador ; o ,)
  const buffer = await file.arrayBuffer()
  let rawRows: RawFacturaRow[]

  if (file.name.toLowerCase().endsWith('.csv')) {
    // CSV con separador punto y coma (formato ERP)
    const text = new TextDecoder('utf-8').decode(buffer)
    const wb   = XLSX.read(text, { type: 'string', FS: ';' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    rawRows    = XLSX.utils.sheet_to_json(ws, { defval: null })
  } else {
    const wb  = XLSX.read(buffer, { type: 'array', cellDates: false })
    const ws  = wb.Sheets[wb.SheetNames[0]]
    rawRows   = XLSX.utils.sheet_to_json(ws, { defval: null })
  }

  // 2. Construir índices de lookup (para joins eficientes O(1))
  const productosMap = new Map(productos.map(p => [str(p.idarticulo), p]))
  const clientesMap = new Map(clientes.map(c => [str(c.idcliente), c]))

  const rows: FacturaInsert[] = []
  let skipped = 0
  const errors: string[] = []
  const skipDetail = { clienteVarios: 0, valorCero: 0, sinProducto: 0, duplicados: 0, otrosErrores: 0 }
  const seen = new Set<string>()

  for (const raw of rawRows) {
    try {
      const idcliente  = str(raw.IDCLIENTE).padStart(6, '0')
      const idarticulo = str(raw.IDARTICULO)
      const nombre     = str(raw.NOMBRE)
      const vendedor   = str(raw.VENDEDOR)
      const total      = Number(raw.TOTAL ?? 0)
      const tipodocume = str(raw.TIPODOCUME)
      const idserie    = str(raw.IDSERIE)
      const numero     = str(raw.NUMERO)

      // ── Filtros de limpieza (igual que el Python) ──────────────────────
      if (nombre.toUpperCase().includes('CLIENTE  VARIOS')) { skipped++; skipDetail.clienteVarios++; continue }
      if (total === 0)                                        { skipped++; skipDetail.valorCero++;     continue }

      // ── Deduplicar por clave natural usando el IDARTICULO raw del Excel ─
      const dedupKey = `${idserie}|${numero}|${idarticulo}`
      if (seen.has(dedupKey)) { skipped++; skipDetail.duplicados++; continue }
      seen.add(dedupKey)

      // ── Join con Productos (left join — no descarta si no hay match) ──
      const producto = productosMap.get(idarticulo) ?? null
      if (!producto) skipDetail.sinProducto++   // contabilizar pero NO omitir

      // ── Join con Clientes (left join) ──────────────────────────────────
      const cliente = clientesMap.get(idcliente)

      // ── Fecha y campos derivados ───────────────────────────────────────
      const fecha = parseDate(raw.FECHA)
      if (!fecha) { errors.push(`Fecha inválida en fila ${numero}`); skipped++; continue }

      const mes    = MESES[fecha.getMonth()]
      const anio   = fecha.getFullYear()
      const semana = calcSemana(fecha.getDate())
      const fechaStr = fecha.toISOString().split('T')[0]   // "YYYY-MM-DD"

      // ── Campos del cliente ─────────────────────────────────────────────
      let departamento    = cliente?.departamento    ?? null
      let provincia       = cliente?.provincia       ?? null
      let distrito        = cliente?.distrito        ?? null
      let zona            = cliente?.zona            ?? null
      let fuerzaDeVenta   = cliente?.responsable     ?? null
      const canal          = cliente?.lista_precios   ?? null
      const canalCluster   = cliente?.canal_cluster   ?? null
      let codMeta          = cliente?.cod             ?? null

      // ── Reglas de reasignación FUERZA DE VENTA (réplica exacta Python) ─

      // Reglas de reasignación solo aplican cuando hay match de producto
      if (producto) {
        // Truchas en Puno → VENDEDOR ZONA PUNO
        if (producto.lineas === 'TRUCHAS' && departamento === 'Puno') {
          fuerzaDeVenta = 'VENDEDOR ZONA PUNO'
        }

        // Pelletizado (VITAMAXPRO/INVITA) en Puno → ASESORA COMERCIAL 2
        if (['VITAMAXPRO', 'INVITA'].includes(producto.marca ?? '') && departamento === 'Puno') {
          fuerzaDeVenta = 'ASESORA COMERCIAL 2'
          if (codMeta === 'VENDEDOR ZONA PUNO-Puno') codMeta = 'ASESORA COMERCIAL 2-PunoOtros'
        }

        // Pelletizado en Apurimac → ASESORA COMERCIAL 2
        if (['VITAMAXPRO', 'INVITA'].includes(producto.marca ?? '') && departamento === 'Apurimac') {
          fuerzaDeVenta = 'ASESORA COMERCIAL 2'
        }

        // Pelletizado en Junin → ASESORA COMERCIAL 2
        if (['VITAMAXPRO', 'INVITA'].includes(producto.marca ?? '') && departamento === 'Junin') {
          fuerzaDeVenta = 'ASESORA COMERCIAL 2'
        }

        // VITAMAXPRO AQUA de VENDEDOR DE COBERTURA → ASESORA COMERCIAL 1
        if (fuerzaDeVenta === 'VENDEDOR DE COBERTURA AREQUIPA' && producto.marca === 'VITAMAXPRO AQUA') {
          fuerzaDeVenta = 'ASESORA COMERCIAL 1'
        }

        // Truchas/Peces de ASESORA COMERCIAL 1 → ajustar cod meta
        if (fuerzaDeVenta === 'ASESORA COMERCIAL 1' && producto.marca === 'VITAMAXPRO AQUA') {
          codMeta = 'ASESORA COMERCIAL 1-ArequipaExtrusion'
        }
      }

      // Ajuste LLAMOCCA HANCCO MAGDALENA con vendedor ARENAS
      if (nombre === 'LLAMOCCA HANCCO MAGDALENA' && vendedor === 'ARENAS LLERENA RODOLFO OMAR') {
        fuerzaDeVenta = 'VENDEDOR TÉCNICO AREQUIPA'
        departamento  = 'Arequipa'
        provincia     = 'Arequipa'
        distrito      = 'Jose Luis Bustamante Y Rivero'
        zona          = 'LAS CONVENCIONES'
        codMeta       = 'VENDEDOR TÉCNICO AREQUIPA-ArequipaCONV'
      }

      // Rellenar departamento y fuerza_de_venta vacíos desde el diccionario
      if (!departamento && codMeta && DICT_COD_META[codMeta]) {
        departamento  = DICT_COD_META[codMeta][0]
      }
      if (!fuerzaDeVenta && codMeta && DICT_COD_META[codMeta]) {
        fuerzaDeVenta = DICT_COD_META[codMeta][1]
      }

      // ── Construir fila final ───────────────────────────────────────────
      const row: FacturaInsert = {
        tipodocume,
        idserie,
        numero,
        fecha:          fechaStr,
        descondici:     str(raw.DESCONDICI) || null,
        idcliente:      cliente ? idcliente : null,
        nombre,
        idarticulo:     producto ? (idarticulo || null) : null,
        desarticul:     str(raw.DESCRIPCIO) || null,
        cantidadar:     raw.CANTIDAD != null ? Number(raw.CANTIDAD) : null,
        pesokgrtot:     raw.PESOKGR   != null ? Number(raw.PESOKGR)  : null,
        valortotal:     total,
        vendedor:       vendedor || null,
        lineas:         producto?.lineas  ?? null,
        marca:          producto?.marca   ?? null,
        mes,
        anio,
        semana,
        departamento,
        provincia,
        distrito,
        zona,
        fuerza_de_venta: fuerzaDeVenta,
        canal,
        canal_cluster:   canalCluster,
        cod_meta:        codMeta,
        mes_importacion: mesImportacion,
        // meta info (solo para referencia, no se guarda en facturas)
        // meta?.meta
      }

      rows.push(row)
    } catch (e) {
      errors.push(`Error en fila: ${String(e)}`)
      skipped++
      skipDetail.otrosErrores++
    }
  }

  return { rows, skipped, errors, skipDetail }
}

// ─── Normalizar visitas (Google Forms ancho → largo) ────────────────────────

export interface VisitaRaw {
  'Marca temporal': string
  'SELECCIONE LA FUERZA DE VENTAS': string
  'Localización': string
  [key: string]: string | number | null
}

export interface VisitaNormalizada {
  marca_temporal:        string
  fuerza_de_venta:       string
  localizacion:          string | null
  latitud:               number | null
  longitud:              number | null
  numero_visita:         number
  es_cliente_nuevo:      boolean
  idcliente:             string | null
  nombre_cliente_nuevo:  string | null
  contacto:              string | null
  zona:                  string | null
  tipo_cliente:          string | null
  especie:               string | null
  animales:              number | null
  granjas:               number | null
  procedencia:           string | null
  problema_abastecimiento: string | null
  lineas_productos:      string | null
  potencial_consumo_tn:  number | null
  marcas_consume:        string | null
}

const PREFIJOS = ['001', '002', '003', '004'] as const

function parseLatLng(loc: string): [number | null, number | null] {
  if (!loc) return [null, null]
  const parts = loc.split(',').map(s => parseFloat(s.trim()))
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]]
  }
  return [null, null]
}

// Google Forms peruano devuelve "D/M/YYYY H:mm:ss" (día/mes/año). Convertimos a ISO
// para que Supabase lo acepte como timestamptz sin ambigüedad MM/DD vs DD/MM.
export function parseFechaPeruana(s: string): string | null {
  if (!s) return null
  const [fecha, hora = '0:00:00'] = s.trim().split(/\s+/)
  const partesFecha = fecha.split('/').map(n => parseInt(n, 10))
  const partesHora  = hora.split(':').map(n => parseInt(n, 10))
  if (partesFecha.length !== 3 || partesFecha.some(isNaN)) return null
  const [d, m, y] = partesFecha
  const [hh = 0, mm = 0, ss = 0] = partesHora
  const date = new Date(y, m - 1, d, hh, mm, ss)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

export function normalizarVisitas(rows: VisitaRaw[]): VisitaNormalizada[] {
  const result: VisitaNormalizada[] = []

  for (const row of rows) {
    const marcaTemporalRaw = str(row['Marca temporal'])
    const marcaTemporal    = parseFechaPeruana(marcaTemporalRaw)
    if (!marcaTemporal) continue  // sin fecha válida, no podemos insertar (NOT NULL en BD)
    const fuerzaDeVenta = str(row['SELECCIONE LA FUERZA DE VENTAS'])
    const localizacion  = str(row['Localización']) || null
    const [latitud, longitud] = localizacion ? parseLatLng(localizacion) : [null, null]

    for (const prefijo of PREFIJOS) {
      const esNuevoRaw = str(row[`${prefijo}. ¿El Cliente a visitar es nuevo?`])
      if (!esNuevoRaw) continue   // columna vacía → no hubo visita N

      const clienteSeleccionado = str(row[`${prefijo}. SELECCIONE EL CLIENTE`]) || null
      const nombreNuevo         = str(row[`${prefijo}. REGISTRE EL NOMBRE DEL CLIENTE NUEVO`]) || null

      // Si no hay nombre en ninguna columna, saltamos
      if (!clienteSeleccionado && !nombreNuevo) continue

      // Reclasificación defensiva:
      // - Si "es nuevo" no es "Si" pero tampoco hay cliente seleccionado, tratamos como nuevo
      //   siempre que tengamos algún nombre. Esto cubre tanto vendedores que escribieron basura
      //   en el Si/No (ej. una fecha) como los que marcaron "No" sin elegir cliente del dropdown.
      let esClienteNuevo = esNuevoRaw.toLowerCase() === 'si'
      if (!esClienteNuevo && !clienteSeleccionado) {
        esClienteNuevo = true
      }

      const potencialRaw = row[`${prefijo}. Por favor, indique el potencial de consumo del cliente en toneladas (TN), entendiendo este como el volumen aproximado que podría llegar a adquirir de nuestra parte.  `]

      result.push({
        marca_temporal:          marcaTemporal,
        fuerza_de_venta:         fuerzaDeVenta,
        localizacion,
        latitud,
        longitud,
        numero_visita:           Number(prefijo),
        es_cliente_nuevo:        esClienteNuevo,
        idcliente:               !esClienteNuevo ? clienteSeleccionado : null,
        nombre_cliente_nuevo:    esClienteNuevo  ? (nombreNuevo ?? clienteSeleccionado) : null,
        contacto:                str(row[`${prefijo}. Ingrese el número de contacto del nuevo cliente`]) || null,
        zona:                    str(row[`${prefijo}. ¿A qué zona pertenece el cliente?`]) || null,
        tipo_cliente:            str(row[`${prefijo}. Seleccione el tipo de cliente`]) || null,
        especie:                 str(row[`${prefijo}. ¿Qué especie cría actualmente el cliente?`]) || null,
        animales:                row[`${prefijo}. Indique cuántos animales está criando actualmente.`] != null
                                   ? Number(row[`${prefijo}. Indique cuántos animales está criando actualmente.`])
                                   : null,
        granjas:                 row[`${prefijo}. Indique cuántas granjas/establos/galones tiene el cliente actualmente.`] != null
                                   ? Number(row[`${prefijo}. Indique cuántas granjas/establos/galones tiene el cliente actualmente.`])
                                   : null,
        procedencia:             str(row[`${prefijo}. Por favor, indique la procedencia o el lugar de adquisición de los animales destinados a la crianza por parte del cliente.`]) || null,
        problema_abastecimiento: str(row[`${prefijo}. ¿El cliente presenta problemas de abastecimiento para sus animales? Por favor, detallar.`]) || null,
        lineas_productos:        str(row[`${prefijo}. ¿Qué líneas de productos comercializa actualmente el cliente ?`]) || null,
        potencial_consumo_tn:    potencialRaw != null ? Number(potencialRaw) : null,
        marcas_consume:          str(row[`${prefijo}. ¿Qué marcas de alimento consume/vende actualmente el cliente? `]) || null,
      })
    }
  }

  return result
}
