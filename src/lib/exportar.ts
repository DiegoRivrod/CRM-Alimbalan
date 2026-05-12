/**
 * Exportar datos a Excel (.xlsx) — browser-side usando la librería xlsx
 * ya instalada para el ETL de importación.
 */
import * as XLSX from 'xlsx'

/**
 * Genera y descarga un archivo .xlsx con las filas indicadas.
 * @param nombreArchivo  Nombre sin extensión (ej: "KPIs_MAYO_2026")
 * @param filas          Array de objetos planos — las claves se usan como encabezados
 */
export function descargarExcel(nombreArchivo: string, filas: object[]): void {
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')

  // Ajustar ancho de columnas automáticamente
  const cols = Object.keys(filas[0] ?? {})
  ws['!cols'] = cols.map(key => ({
    wch: Math.max(
      key.length,
      ...filas.map(f => String((f as Record<string, unknown>)[key] ?? '').length),
    ) + 2,
  }))

  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`)
}

// ── Exportadores tipados por reporte ─────────────────────────────────────────

export function exportarKpisVendedores(
  vendedores: { fuerza_de_venta: string; total_ventas: number; meta_total: number; pct_cumplimiento: number }[],
  mes: string,
  anio: number,
) {
  const filas = vendedores.map(v => ({
    'Fuerza de venta':   v.fuerza_de_venta,
    'Ventas (S/)':       v.total_ventas,
    'Meta (S/)':         v.meta_total,
    'Cumplimiento (%)':  v.pct_cumplimiento,
  }))
  descargarExcel(`KPIs_${mes}_${anio}`, filas)
}

export function exportarClientesInactivos(
  clientes: { idcliente: string; nombre: string; responsable: string | null; ultima_fecha_factura: string | null; dias_sin_compra: number | null }[],
  dias: number,
) {
  const filas = clientes.map(c => ({
    'ID Cliente':      c.idcliente,
    'Nombre':          c.nombre,
    'Responsable':     c.responsable ?? '',
    'Última compra':   c.ultima_fecha_factura ?? 'Sin historial',
    'Días sin compra': c.dias_sin_compra ?? '',
  }))
  descargarExcel(`Inactivos_mas_${dias}d`, filas)
}

export function exportarClientes(
  clientes: {
    idcliente: string; nombre: string; responsable: string | null; zona: string | null
    departamento: string | null; status: string | null
    ultima_fecha_factura: string | null; ultimo_valor: number | null; ultimo_kg: number | null
  }[],
) {
  const filas = clientes.map(c => ({
    'ID':             c.idcliente,
    'Nombre':         c.nombre,
    'Responsable':    c.responsable ?? '',
    'Zona':           c.zona ?? '',
    'Departamento':   c.departamento ?? '',
    'Estado':         c.status ?? '',
    'Última compra':  c.ultima_fecha_factura ?? '',
    'Último valor S/':c.ultimo_valor ?? 0,
    'Últimos KG':     c.ultimo_kg ?? 0,
  }))
  descargarExcel('Clientes', filas)
}

export function exportarProspectos(
  prospectos: {
    nombre: string; fuerza_de_venta: string; zona: string | null
    estado: string; especie: string | null; potencial_tn: number | null
    match_aprobado: boolean; created_at: string
  }[],
) {
  const filas = prospectos.map(p => ({
    'Nombre':          p.nombre,
    'Vendedor':        p.fuerza_de_venta,
    'Zona':            p.zona ?? '',
    'Estado':          p.estado,
    'Especie':         p.especie ?? '',
    'Potencial TN':    p.potencial_tn ?? '',
    'Match aprobado':  p.match_aprobado ? 'Sí' : 'No',
    'Fecha registro':  new Date(p.created_at).toLocaleDateString('es-PE'),
  }))
  descargarExcel('Prospectos_abiertos', filas)
}
