import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { procesarFacturasExcel, normalizarVisitas, type VisitaRaw } from './etl'
import type { Cliente, Producto, Meta } from '@/types/supabase'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const productoBase: Producto = {
  idarticulo: '1001',
  descripcio: 'PROD TEST',
  lineas: 'CUYES',
  marca: 'PRECISSION',
  presentacion: '40KG',
  peso_saco: 40,
  tipo: null,
  meta: null,
  updated_at: '2026-01-01',
}

const clienteBase: Cliente = {
  idcliente: '000123',
  razon_sg: null,
  id_razon: null,
  nombre: 'CLIENTE TEST',
  responsable: 'ASESORA COMERCIAL 1',
  zona: 'Z1',
  departamento: 'Arequipa',
  provincia: 'Arequipa',
  distrito: 'Cercado',
  vendedor: null,
  localizacion: null,
  lista_precios: 'CANAL_A',
  canal_cluster: 'CLUSTER_A',
  top: null,
  status: 'ACTIVO',
  cod: 'ASESORA COMERCIAL 1-ArequipaArequipa',
  meta_departamento: null,
  meta_top: null,
  meta_canal_cluster: null,
  canal_truchas: null,
  meta_truchas_puno: null,
  meta_semana_1: null,
  meta_semana_2: null,
  meta_semana_3: null,
  meta_semana_4: null,
  updated_at: '2026-01-01',
}

const metasVacias: Meta[] = []

/** Construye un File .xlsx en memoria a partir de filas JSON (formato ERP). */
function makeFacturaFile(rows: Array<Record<string, unknown>>): File {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buf], 'facturas.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function filaERP(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    TIPODOCUME: 'FACTURA',
    IDSERIE: 'F001',
    NUMERO: '1',
    FECHA: '2026-04-10',
    DESCONDICI: 'CONTADO',
    IDCLIENTE: '123',
    NOMBRE: 'CLIENTE TEST',
    IDARTICULO: '1001',
    DESCRIPCIO: 'PROD TEST',
    CANTIDAD: 10,
    PESOKGR: 400,
    TOTAL: 1500,
    VENDEDOR: 'JUAN PEREZ',
    ...overrides,
  }
}

// ─── procesarFacturasExcel ───────────────────────────────────────────────────

describe('procesarFacturasExcel — filtros de limpieza', () => {
  it('procesa una fila válida y produce 1 fila lista para Supabase', async () => {
    const file = makeFacturaFile([filaERP()])
    const res = await procesarFacturasExcel(file, [clienteBase], [productoBase], metasVacias, 'ABRIL_2026')
    expect(res.rows).toHaveLength(1)
    expect(res.skipped).toBe(0)
    expect(res.rows[0].idcliente).toBe('000123')
    expect(res.rows[0].valortotal).toBe(1500)
  })

  it('omite filas con nombre "CLIENTE  VARIOS" (dos espacios, igual que el Python)', async () => {
    const file = makeFacturaFile([
      filaERP(),
      filaERP({ NUMERO: '2', NOMBRE: 'CLIENTE  VARIOS' }),
    ])
    const res = await procesarFacturasExcel(file, [clienteBase], [productoBase], metasVacias, 'ABRIL_2026')
    expect(res.rows).toHaveLength(1)
    expect(res.skipDetail.clienteVarios).toBe(1)
  })

  it('omite filas con TOTAL = 0 (anticipos/fletes/admin)', async () => {
    const file = makeFacturaFile([
      filaERP(),
      filaERP({ NUMERO: '2', TOTAL: 0 }),
    ])
    const res = await procesarFacturasExcel(file, [clienteBase], [productoBase], metasVacias, 'ABRIL_2026')
    expect(res.rows).toHaveLength(1)
    expect(res.skipDetail.valorCero).toBe(1)
  })

  it('omite filas cuyo IDARTICULO no está en el catálogo', async () => {
    const file = makeFacturaFile([
      filaERP(),
      filaERP({ NUMERO: '2', IDARTICULO: '9999' }),
    ])
    const res = await procesarFacturasExcel(file, [clienteBase], [productoBase], metasVacias, 'ABRIL_2026')
    expect(res.rows).toHaveLength(1)
    expect(res.skipDetail.sinProducto).toBe(1)
  })

  it('hace padStart(6) al IDCLIENTE para emparejar con el catálogo', async () => {
    const file = makeFacturaFile([filaERP({ IDCLIENTE: '123' })])
    const res = await procesarFacturasExcel(file, [clienteBase], [productoBase], metasVacias, 'ABRIL_2026')
    expect(res.rows[0].idcliente).toBe('000123')
    // Y debe haber unido al cliente correctamente
    expect(res.rows[0].departamento).toBe('Arequipa')
  })
})

describe('procesarFacturasExcel — cálculo de SEMANA por día del mes', () => {
  it.each([
    [1, 'SEMANA 1'],
    [8, 'SEMANA 1'],
    [9, 'SEMANA 2'],
    [15, 'SEMANA 2'],
    [16, 'SEMANA 3'],
    [22, 'SEMANA 3'],
    [23, 'SEMANA 4'],
    [30, 'SEMANA 4'],
  ])('día %i → %s', async (dia, semanaEsperada) => {
    // Formato YYYY/MM/DD → JS lo interpreta como hora local (evita off-by-one por UTC vs UTC-5)
    const fecha = `2026/04/${String(dia).padStart(2, '0')}`
    const file = makeFacturaFile([filaERP({ FECHA: fecha })])
    const res = await procesarFacturasExcel(file, [clienteBase], [productoBase], metasVacias, 'ABRIL_2026')
    expect(res.rows[0].semana).toBe(semanaEsperada)
  })
})

describe('procesarFacturasExcel — deduplicación por (idserie, numero, idarticulo)', () => {
  it('descarta duplicados con la misma clave natural', async () => {
    const file = makeFacturaFile([
      filaERP({ NUMERO: '100', IDARTICULO: '1001' }),
      filaERP({ NUMERO: '100', IDARTICULO: '1001' }), // duplicado exacto
      filaERP({ NUMERO: '101', IDARTICULO: '1001' }), // distinto numero
    ])
    const res = await procesarFacturasExcel(file, [clienteBase], [productoBase], metasVacias, 'ABRIL_2026')
    expect(res.rows).toHaveLength(2)
    expect(res.skipDetail.duplicados).toBe(1)
  })
})

describe('procesarFacturasExcel — reglas de reasignación FUERZA_DE_VENTA', () => {
  it('Truchas + Puno → VENDEDOR ZONA PUNO', async () => {
    const cliente: Cliente = { ...clienteBase, departamento: 'Puno', responsable: 'ASESORA COMERCIAL 2' }
    const producto: Producto = { ...productoBase, lineas: 'TRUCHAS', marca: 'OTRO' }
    const file = makeFacturaFile([filaERP()])
    const res = await procesarFacturasExcel(file, [cliente], [producto], metasVacias, 'ABRIL_2026')
    expect(res.rows[0].fuerza_de_venta).toBe('VENDEDOR ZONA PUNO')
  })

  it('VITAMAXPRO + Puno → ASESORA COMERCIAL 2 (y ajusta cod_meta)', async () => {
    const cliente: Cliente = {
      ...clienteBase,
      departamento: 'Puno',
      responsable: 'OTRO',
      cod: 'VENDEDOR ZONA PUNO-Puno',
    }
    const producto: Producto = { ...productoBase, marca: 'VITAMAXPRO' }
    const file = makeFacturaFile([filaERP()])
    const res = await procesarFacturasExcel(file, [cliente], [producto], metasVacias, 'ABRIL_2026')
    expect(res.rows[0].fuerza_de_venta).toBe('ASESORA COMERCIAL 2')
    expect(res.rows[0].cod_meta).toBe('ASESORA COMERCIAL 2-PunoOtros')
  })

  it('INVITA + Apurimac → ASESORA COMERCIAL 2', async () => {
    const cliente: Cliente = { ...clienteBase, departamento: 'Apurimac', responsable: 'OTRO' }
    const producto: Producto = { ...productoBase, marca: 'INVITA' }
    const file = makeFacturaFile([filaERP()])
    const res = await procesarFacturasExcel(file, [cliente], [producto], metasVacias, 'ABRIL_2026')
    expect(res.rows[0].fuerza_de_venta).toBe('ASESORA COMERCIAL 2')
  })

  it('VITAMAXPRO AQUA + VENDEDOR DE COBERTURA AREQUIPA → ASESORA COMERCIAL 1 (con cod meta Extrusion)', async () => {
    const cliente: Cliente = { ...clienteBase, responsable: 'VENDEDOR DE COBERTURA AREQUIPA' }
    const producto: Producto = { ...productoBase, marca: 'VITAMAXPRO AQUA' }
    const file = makeFacturaFile([filaERP()])
    const res = await procesarFacturasExcel(file, [cliente], [producto], metasVacias, 'ABRIL_2026')
    expect(res.rows[0].fuerza_de_venta).toBe('ASESORA COMERCIAL 1')
    expect(res.rows[0].cod_meta).toBe('ASESORA COMERCIAL 1-ArequipaExtrusion')
  })

  it('LLAMOCCA HANCCO MAGDALENA + vendedor ARENAS → ajuste manual completo', async () => {
    const cliente: Cliente = { ...clienteBase, nombre: 'LLAMOCCA HANCCO MAGDALENA', responsable: 'OTRO' }
    const file = makeFacturaFile([
      filaERP({ NOMBRE: 'LLAMOCCA HANCCO MAGDALENA', VENDEDOR: 'ARENAS LLERENA RODOLFO OMAR' }),
    ])
    const res = await procesarFacturasExcel(file, [cliente], [productoBase], metasVacias, 'ABRIL_2026')
    expect(res.rows[0].fuerza_de_venta).toBe('VENDEDOR TÉCNICO AREQUIPA')
    expect(res.rows[0].departamento).toBe('Arequipa')
    expect(res.rows[0].zona).toBe('LAS CONVENCIONES')
    expect(res.rows[0].cod_meta).toBe('VENDEDOR TÉCNICO AREQUIPA-ArequipaCONV')
  })
})

describe('procesarFacturasExcel — campos derivados (mes, anio, mes_importacion)', () => {
  it('extrae mes ABRIL y año 2026 de la fecha', async () => {
    const file = makeFacturaFile([filaERP({ FECHA: '2026-04-10' })])
    const res = await procesarFacturasExcel(file, [clienteBase], [productoBase], metasVacias, 'ABRIL_2026')
    expect(res.rows[0].mes).toBe('ABRIL')
    expect(res.rows[0].anio).toBe(2026)
    expect(res.rows[0].mes_importacion).toBe('ABRIL_2026')
  })
})

// ─── normalizarVisitas ───────────────────────────────────────────────────────

describe('normalizarVisitas', () => {
  function visitaWide(overrides: Partial<VisitaRaw> = {}): VisitaRaw {
    return {
      'Marca temporal': '10/4/2026 10:00:00',  // Formato peruano D/M/YYYY (Google Forms)
      'SELECCIONE LA FUERZA DE VENTAS': 'ASESORA COMERCIAL 1',
      'Localización': '-16.4090,-71.5375',
      ...overrides,
    } as VisitaRaw
  }

  it('transforma 1 visita "Si" (nuevo) en 1 fila con es_cliente_nuevo=true', () => {
    const rows = normalizarVisitas([
      visitaWide({
        '001. ¿El Cliente a visitar es nuevo?': 'Si',
        '001. REGISTRE EL NOMBRE DEL CLIENTE NUEVO': 'PROSPECTO X',
        '001. Ingrese el número de contacto del nuevo cliente': '999111222',
      }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].es_cliente_nuevo).toBe(true)
    expect(rows[0].nombre_cliente_nuevo).toBe('PROSPECTO X')
    expect(rows[0].idcliente).toBeNull()
    expect(rows[0].numero_visita).toBe(1)
    expect(rows[0].latitud).toBeCloseTo(-16.4090, 4)
    expect(rows[0].longitud).toBeCloseTo(-71.5375, 4)
  })

  it('transforma 1 visita a cliente existente en 1 fila con idcliente seteado', () => {
    const rows = normalizarVisitas([
      visitaWide({
        '001. ¿El Cliente a visitar es nuevo?': 'No',
        '001. SELECCIONE EL CLIENTE': '000123',
      }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].es_cliente_nuevo).toBe(false)
    expect(rows[0].idcliente).toBe('000123')
    expect(rows[0].nombre_cliente_nuevo).toBeNull()
  })

  it('expande hasta 4 visitas por fila (wide → long)', () => {
    const rows = normalizarVisitas([
      visitaWide({
        '001. ¿El Cliente a visitar es nuevo?': 'No',
        '001. SELECCIONE EL CLIENTE': '000123',
        '002. ¿El Cliente a visitar es nuevo?': 'Si',
        '002. REGISTRE EL NOMBRE DEL CLIENTE NUEVO': 'PROSP 2',
        '003. ¿El Cliente a visitar es nuevo?': 'No',
        '003. SELECCIONE EL CLIENTE': '000999',
        // 004 vacío → no debe aparecer
      }),
    ])
    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.numero_visita)).toEqual([1, 2, 3])
  })

  it('omite visitas sin nombre y sin cliente (columna vacía)', () => {
    const rows = normalizarVisitas([
      visitaWide({
        '001. ¿El Cliente a visitar es nuevo?': 'Si',
        // sin nombre ni cliente seleccionado
      }),
    ])
    expect(rows).toHaveLength(0)
  })

  it('parsea localización ausente como [null, null]', () => {
    const rows = normalizarVisitas([
      visitaWide({
        'Localización': '',
        '001. ¿El Cliente a visitar es nuevo?': 'No',
        '001. SELECCIONE EL CLIENTE': '000123',
      }),
    ])
    expect(rows[0].latitud).toBeNull()
    expect(rows[0].longitud).toBeNull()
  })
})
