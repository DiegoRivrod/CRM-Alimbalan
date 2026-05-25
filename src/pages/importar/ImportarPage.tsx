/**
 * ImportarPage — Fase 2 ETL
 * Permite:
 *  1. Sincronizar maestros desde Google Sheets (clientes, productos, metas)
 *  2. Importar Excel de facturas del ERP (aplica toda la lógica ETL en el browser)
 *  3. Subir CSV de visitas Google Forms (normaliza ancho→largo)
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, RefreshCw, CheckCircle, XCircle, Loader2, ChevronRight, Database, FileSpreadsheet, ClipboardList, History } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { procesarFacturasExcel } from '@/lib/etl'
import { fetchClientes, fetchProductos, fetchMetas, parseVisitasCSV } from '@/lib/googleSheets'
import type { Cliente, Producto, Meta, Importacion } from '@/types/supabase'

type ImportacionConAutor = Importacion & { autor_nombre: string }

const TIPO_LABEL: Record<string, string> = {
  facturas: 'Facturas',
  visitas:  'Visitas',
  maestros: 'Maestros',
}
const TIPO_BADGE: Record<string, string> = {
  facturas: 'bg-blue-50 text-blue-700',
  visitas:  'bg-purple-50 text-purple-700',
  maestros: 'bg-gray-100 text-gray-600',
}

async function registrarImportacion(payload: Omit<Importacion, 'id' | 'created_at'>) {
  await supabase.from('importaciones').insert(payload as never)
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

type StepStatus = 'idle' | 'running' | 'ok' | 'error'

interface StepState {
  status: StepStatus
  message: string
  detail?: string
}

const initialStep = (): StepState => ({ status: 'idle', message: '' })

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ImportarPage() {
  // ── Estado maestros ────────────────────────────────────────────────────
  const [stepClientes,  setStepClientes]  = useState<StepState>(initialStep())
  const [stepProductos, setStepProductos] = useState<StepState>(initialStep())
  const [stepMetas,     setStepMetas]     = useState<StepState>(initialStep())
  const [syncingMaestros, setSyncingMaestros] = useState(false)

  // ── Estado facturas ────────────────────────────────────────────────────
  const [facturaFile,      setFacturaFile]      = useState<File | null>(null)
  const [mesImport,        setMesImport]        = useState('')
  const [stepETL,          setStepETL]          = useState<StepState>(initialStep())
  const [stepInsert,       setStepInsert]       = useState<StepState>(initialStep())
  const [stepConversion,   setStepConversion]   = useState<StepState>(initialStep())
  const [importingFact,    setImportingFact]    = useState(false)
  const facturaInputRef = useRef<HTMLInputElement>(null)

  // ── Estado visitas ─────────────────────────────────────────────────────
  const [visitaFile,   setVisitaFile]   = useState<File | null>(null)
  const [stepVisitas,  setStepVisitas]  = useState<StepState>(initialStep())
  const [importingVis, setImportingVis] = useState(false)
  const visitaInputRef = useRef<HTMLInputElement>(null)

  // ── Historial de importaciones ─────────────────────────────────────────
  const [historial,       setHistorial]       = useState<ImportacionConAutor[]>([])
  const [loadingHistorial,setLoadingHistorial] = useState(true)

  const cargarHistorial = useCallback(async () => {
    setLoadingHistorial(true)
    const { data: rows } = await supabase
      .from('importaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15)

    const lista = (rows ?? []) as Importacion[]
    const ids   = [...new Set(lista.map(r => r.usuario_id))]
    const { data: perfiles } = ids.length
      ? await supabase.from('profiles').select('id, nombre').in('id', ids)
      : { data: [] }

    const mapaAutores: Record<string, string> = {}
    ;(perfiles ?? []).forEach((p: { id: string; nombre: string }) => { mapaAutores[p.id] = p.nombre })

    setHistorial(lista.map(r => ({ ...r, autor_nombre: mapaAutores[r.usuario_id] ?? 'Usuario' })))
    setLoadingHistorial(false)
  }, [])

  useEffect(() => { cargarHistorial() }, [cargarHistorial])

  // ─── Helpers ─────────────────────────────────────────────────────────────

  async function upsertBatch<T extends object>(
    table: string,
    rows: T[],
    onConflict: string,
    chunkSize = 500,
  ): Promise<{ count: number; error: string | null }> {
    let total = 0
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const { error } = await supabase.from(table).upsert(chunk as never[], { onConflict })
      if (error) return { count: total, error: error.message }
      total += chunk.length
    }
    return { count: total, error: null }
  }

  // ─── Sincronizar maestros ─────────────────────────────────────────────────

  async function handleSyncMaestros() {
    setSyncingMaestros(true)
    setStepClientes(initialStep())
    setStepProductos(initialStep())
    setStepMetas(initialStep())

    // Clientes
    setStepClientes({ status: 'running', message: 'Leyendo Google Sheets...' })
    try {
      const data = await fetchClientes()
      setStepClientes({ status: 'running', message: `Insertando ${data.length} clientes...` })
      const { count, error } = await upsertBatch<Omit<Cliente, 'updated_at'>>(
        'clientes', data, 'idcliente'
      )
      if (error) throw new Error(error)
      setStepClientes({ status: 'ok', message: `${count} clientes sincronizados` })
    } catch (e) {
      setStepClientes({ status: 'error', message: 'Error en clientes', detail: String(e) })
      setSyncingMaestros(false)
      return
    }

    // Productos
    setStepProductos({ status: 'running', message: 'Leyendo Google Sheets...' })
    try {
      const data = await fetchProductos()
      setStepProductos({ status: 'running', message: `Insertando ${data.length} productos...` })
      const { count, error } = await upsertBatch<Omit<Producto, 'updated_at'>>(
        'productos', data, 'idarticulo'
      )
      if (error) throw new Error(error)
      setStepProductos({ status: 'ok', message: `${count} productos sincronizados` })
    } catch (e) {
      setStepProductos({ status: 'error', message: 'Error en productos', detail: String(e) })
      setSyncingMaestros(false)
      return
    }

    // Metas
    setStepMetas({ status: 'running', message: 'Leyendo Google Sheets...' })
    try {
      const data = await fetchMetas()
      setStepMetas({ status: 'running', message: `Insertando ${data.length} metas...` })
      const { count, error } = await upsertBatch<Omit<Meta, 'updated_at'>>(
        'metas', data, 'cod'
      )
      if (error) throw new Error(error)
      setStepMetas({ status: 'ok', message: `${count} metas sincronizadas` })
    } catch (e) {
      setStepMetas({ status: 'error', message: 'Error en metas', detail: String(e) })
      setSyncingMaestros(false)
      return
    }

    // Registrar en historial
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await registrarImportacion({ tipo: 'maestros', mes_importacion: null, filas_procesadas: 0, filas_omitidas: 0, prospectos_conv: 0, usuario_id: user.id })
    }
    await cargarHistorial()
    setSyncingMaestros(false)
  }

  // ─── Auto-conversión de prospectos ───────────────────────────────────────

  async function autoConvertirProspectos(
    rows: import('@/lib/etl').FacturaInsert[]
  ): Promise<number> {
    const idclientesSet = [...new Set(rows.map(r => r.idcliente).filter(Boolean))]
    if (idclientesSet.length === 0) return 0

    // Buscar prospectos con match aprobado en seguimiento cuyos clientes sugeridos aparecen
    const { data: prospectos } = await supabase
      .from('prospectos')
      .select('id, idcliente_sugerido')
      .eq('match_aprobado', true)
      .eq('estado', 'seguimiento')
      .in('idcliente_sugerido', idclientesSet)

    if (!prospectos?.length) return 0

    const { data: { user } } = await supabase.auth.getUser()
    let convertidos = 0

    for (const prospecto of prospectos as { id: string; idcliente_sugerido: string }[]) {
      // Primera factura del cliente sugerido (más antigua por fecha)
      const facturasCliente = rows
        .filter(f => f.idcliente === prospecto.idcliente_sugerido)
        .sort((a, b) => new Date(a.fecha ?? '').getTime() - new Date(b.fecha ?? '').getTime())

      if (facturasCliente.length === 0) continue

      const primera = facturasCliente[0]
      const docventa = `${primera.idserie}-${primera.numero}`

      await supabase
        .from('prospectos')
        .update({
          estado:                   'convertido',
          primera_factura_docventa: docventa,
          fecha_conversion:         primera.fecha ?? null,
        } as never)
        .eq('id', prospecto.id)

      if (user) {
        await supabase
          .from('actividad')
          .insert({
            tipo:         'seguimiento',
            prospecto_id: prospecto.id,
            usuario_id:   user.id,
            nota:         `Convertido automáticamente al detectar primera factura ${docventa}`,
          } as never)
      }

      convertidos++
    }

    return convertidos
  }

  // ─── Importar facturas ────────────────────────────────────────────────────

  async function handleImportarFacturas() {
    if (!facturaFile || !mesImport.trim()) return
    setImportingFact(true)
    setStepETL(initialStep())
    setStepInsert(initialStep())
    setStepConversion(initialStep())

    // 1. Cargar maestros desde Supabase para los joins
    setStepETL({ status: 'running', message: 'Cargando maestros desde Supabase...' })
    const [{ data: clientes }, { data: productos }, { data: metas }] = await Promise.all([
      supabase.from('clientes').select('*'),
      supabase.from('productos').select('*'),
      supabase.from('metas').select('*'),
    ])

    if (!clientes?.length || !productos?.length) {
      setStepETL({
        status: 'error',
        message: 'Maestros vacíos',
        detail: 'Sincroniza Clientes y Productos desde Google Sheets primero.',
      })
      setImportingFact(false)
      return
    }

    // 2. Procesar Excel
    setStepETL({ status: 'running', message: 'Procesando Excel (ETL)...' })
    try {
      const { rows, skipped, errors, skipDetail } = await procesarFacturasExcel(
        facturaFile,
        clientes as Cliente[],
        productos as Producto[],
        (metas ?? []) as Meta[],
        mesImport.trim().toUpperCase(),
      )
      const detalle = [
        skipDetail.clienteVarios  ? `${skipDetail.clienteVarios} Cliente Varios`    : '',
        skipDetail.valorCero      ? `${skipDetail.valorCero} valor=0 (anticipos/fletes)` : '',
        skipDetail.sinProducto    ? `${skipDetail.sinProducto} sin match en productos` : '',
        skipDetail.duplicados     ? `${skipDetail.duplicados} duplicados`            : '',
      ].filter(Boolean).join(' · ')
      setStepETL({
        status: 'ok',
        message: `${rows.length} filas procesadas, ${skipped} omitidas`,
        detail: detalle || (errors.length ? errors.slice(0, 2).join(' | ') : undefined),
      })

      // 3. Insertar en Supabase — upsert por clave natural (idserie, numero, idarticulo)
      setStepInsert({ status: 'running', message: `Insertando ${rows.length} filas en Supabase...` })
      const { count, error } = await upsertBatch(
        'facturas', rows, 'idserie,numero,idarticulo'
      )
      if (error) throw new Error(error)
      setStepInsert({ status: 'ok', message: `${count} facturas insertadas correctamente` })

      // 4. Auto-convertir prospectos con match aprobado cuyos clientes aparecen en la importación
      setStepConversion({ status: 'running', message: 'Detectando prospectos convertidos...' })
      const nConvertidos = await autoConvertirProspectos(rows)
      setStepConversion({
        status: 'ok',
        message: nConvertidos > 0
          ? `${nConvertidos} prospecto${nConvertidos > 1 ? 's' : ''} convertido${nConvertidos > 1 ? 's' : ''} automáticamente`
          : 'Sin prospectos nuevos para convertir',
      })

      // 5. Registrar en historial
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await registrarImportacion({
          tipo:             'facturas',
          mes_importacion:  mesImport.trim().toUpperCase(),
          filas_procesadas: count,
          filas_omitidas:   skipped,
          prospectos_conv:  nConvertidos,
          usuario_id:       user.id,
        })
      }
      await cargarHistorial()
    } catch (e) {
      const msg = String(e)
      if (msg.includes('ETL')) {
        setStepETL({ status: 'error', message: 'Error al procesar Excel', detail: msg })
      } else {
        setStepInsert({ status: 'error', message: 'Error al insertar en Supabase', detail: msg })
      }
    }

    setImportingFact(false)
  }

  // ─── Importar visitas ─────────────────────────────────────────────────────

  async function handleImportarVisitas() {
    if (!visitaFile) return
    setImportingVis(true)
    setStepVisitas({ status: 'running', message: 'Normalizando visitas (ancho → largo)...' })

    try {
      const visitas = await parseVisitasCSV(visitaFile)
      setStepVisitas({ status: 'running', message: `Resolviendo clientes (${visitas.length} visitas)...` })

      // El Google Form devuelve el NOMBRE del cliente en "SELECCIONE EL CLIENTE", no el IDCLIENTE.
      // Resolvemos el idcliente real haciendo match por nombre normalizado. Si no hay match,
      // reclasificamos la visita como cliente nuevo para que se cree un prospecto.
      const { data: clientesRows } = await supabase
        .from('clientes')
        .select('idcliente, nombre')
      const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
      const mapaNombreAId = new Map<string, string>()
      for (const c of (clientesRows ?? []) as Array<{ idcliente: string; nombre: string }>) {
        if (c.nombre) mapaNombreAId.set(normalizar(c.nombre), c.idcliente)
      }

      let resueltas = 0, reclasificadas = 0
      const visitasResueltas = visitas.map(v => {
        // Si ya tiene idcliente con formato válido (1-6 dígitos) lo dejamos
        if (!v.es_cliente_nuevo && v.idcliente && /^\d{1,6}$/.test(v.idcliente)) {
          resueltas++
          return v
        }
        // Si es cliente existente pero el "idcliente" es en realidad un nombre, intentar resolver
        if (!v.es_cliente_nuevo && v.idcliente) {
          const idReal = mapaNombreAId.get(normalizar(v.idcliente))
          if (idReal) {
            resueltas++
            return { ...v, idcliente: idReal.padStart(6, '0') }
          }
          // No matchea → reclasificar como cliente nuevo
          reclasificadas++
          return { ...v, es_cliente_nuevo: true, nombre_cliente_nuevo: v.idcliente, idcliente: null }
        }
        return v
      })

      setStepVisitas({ status: 'running', message: `Insertando ${visitasResueltas.length} visitas (${resueltas} resueltas · ${reclasificadas} reclasificadas)...` })

      const { count, error } = await upsertBatch('visitas', visitasResueltas, 'marca_temporal,fuerza_de_venta,numero_visita')
      if (error) throw new Error(error)

      // Crear prospectos para visitas de clientes nuevos
      const nuevos = visitasResueltas.filter(v => v.es_cliente_nuevo && v.nombre_cliente_nuevo)
      if (nuevos.length) {
        const prospectos = nuevos.map(v => ({
          nombre:          v.nombre_cliente_nuevo!,
          contacto:        v.contacto,
          fuerza_de_venta: v.fuerza_de_venta,
          zona:            v.zona,
          especie:         v.especie,
          potencial_tn:    v.potencial_consumo_tn,
          marcas_consume:  v.marcas_consume,
          estado:          'nuevo' as const,
        }))
        await upsertBatch('prospectos', prospectos, 'nombre,fuerza_de_venta')
      }

      setStepVisitas({
        status: 'ok',
        message: `${count} visitas insertadas · ${nuevos.length} prospectos creados`,
      })

      // Registrar en historial
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await registrarImportacion({
          tipo: 'visitas', mes_importacion: null,
          filas_procesadas: count, filas_omitidas: 0, prospectos_conv: nuevos.length,
          usuario_id: user.id,
        })
      }
      await cargarHistorial()
    } catch (e) {
      setStepVisitas({ status: 'error', message: 'Error al importar visitas', detail: String(e) })
    }

    setImportingVis(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Importar datos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sincroniza maestros desde Google Sheets, carga el Excel de facturas y sube el CSV de visitas.
        </p>
      </div>

      {/* ── Sección 1: Maestros ─────────────────────────────────────────── */}
      <section className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base">1. Sincronizar maestros</h3>
          </div>
          {/* Último sync automático */}
          {(() => {
            const ultimoAuto = historial.find(
              h => h.tipo === 'maestros' && h.usuario_id === '00000000-0000-0000-0000-000000000000'
            )
            const ultimoManual = historial.find(
              h => h.tipo === 'maestros' && h.usuario_id !== '00000000-0000-0000-0000-000000000000'
            )
            const ultimo = ultimoAuto ?? ultimoManual
            if (!ultimo) return null
            const esAuto = ultimo.usuario_id === '00000000-0000-0000-0000-000000000000'
            return (
              <span className="text-xs text-muted-foreground bg-muted/60 px-3 py-1 rounded-full flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" />
                Último sync {esAuto ? 'automático' : `por ${ultimo.autor_nombre}`}:{' '}
                {new Date(ultimo.created_at).toLocaleDateString('es-PE', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            )
          })()}
        </div>
        <p className="text-sm text-muted-foreground">
          Lee Clientes, Productos y Metas desde los Google Sheets de origen y actualiza Supabase.
          El sync automático corre diariamente a las 6:00 AM (hora Perú) vía cron de Supabase.
        </p>
        <button
          onClick={handleSyncMaestros}
          disabled={syncingMaestros}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {syncingMaestros
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          Sincronizar Google Sheets
        </button>

        <div className="space-y-2 pt-1">
          <StepRow label="Clientes"  step={stepClientes} />
          <StepRow label="Productos" step={stepProductos} />
          <StepRow label="Metas"     step={stepMetas} />
        </div>
      </section>

      {/* ── Sección 2: Facturas ─────────────────────────────────────────── */}
      <section className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-base">2. Importar facturas (Excel ERP)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Sube el reporte mensual de facturas. Se aplica el ETL completo (joins, semanas, reasignación de fuerza de venta) antes de insertar.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          {/* Selector de archivo */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Archivo facturas (.xlsx o .csv)
            </label>
            <button
              onClick={() => facturaInputRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span className="truncate">{facturaFile ? facturaFile.name : 'Seleccionar archivo...'}</span>
            </button>
            <input
              ref={facturaInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => setFacturaFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Mes de importación */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Etiqueta del mes (ej: ABRIL_2026)
            </label>
            <input
              type="text"
              value={mesImport}
              onChange={e => setMesImport(e.target.value)}
              placeholder="ABRIL_2026"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <button
          onClick={handleImportarFacturas}
          disabled={importingFact || !facturaFile || !mesImport.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {importingFact
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <ChevronRight className="w-4 h-4" />}
          Procesar e importar
        </button>

        <div className="space-y-2 pt-1">
          <StepRow label="ETL (joins + limpieza)"       step={stepETL} />
          <StepRow label="Insertar en Supabase"         step={stepInsert} />
          <StepRow label="Auto-conversión prospectos"   step={stepConversion} />
        </div>
      </section>

      {/* ── Sección 3: Visitas ──────────────────────────────────────────── */}
      <section className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-base">3. Importar visitas (Google Forms CSV)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Descarga el CSV desde el Google Sheet de respuestas y súbelo aquí. Se normaliza de formato ancho (001/002/003/004) a una fila por visita y se crean prospectos automáticamente.
        </p>

        <button
          onClick={() => visitaInputRef.current?.click()}
          className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Upload className="w-4 h-4 shrink-0" />
          <span className="truncate">{visitaFile ? visitaFile.name : 'Seleccionar CSV de visitas...'}</span>
        </button>
        <input
          ref={visitaInputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={e => setVisitaFile(e.target.files?.[0] ?? null)}
        />

        <button
          onClick={handleImportarVisitas}
          disabled={importingVis || !visitaFile}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {importingVis
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <ChevronRight className="w-4 h-4" />}
          Normalizar e importar
        </button>

        <StepRow label="Visitas y prospectos" step={stepVisitas} />
      </section>

      {/* ── Historial de importaciones ───────────────────────────────── */}
      <section className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-base">Historial de importaciones</h3>
        </div>

        {loadingHistorial ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : historial.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin importaciones registradas aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">Mes / Detalle</th>
                  <th className="text-right pb-2 font-medium text-muted-foreground">Procesadas</th>
                  <th className="text-right pb-2 font-medium text-muted-foreground">Omitidas</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground hidden sm:table-cell">Usuario</th>
                  <th className="text-right pb-2 font-medium text-muted-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {historial.map(h => (
                  <tr key={h.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_BADGE[h.tipo]}`}>
                        {TIPO_LABEL[h.tipo]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {h.mes_importacion ?? (h.tipo === 'maestros' ? 'Google Sheets' : '—')}
                      {h.prospectos_conv > 0 && (
                        <span className="ml-2 text-xs text-green-600">+{h.prospectos_conv} conv.</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-medium">{h.filas_procesadas.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{h.filas_omitidas.toLocaleString()}</td>
                    <td className="py-2.5 text-muted-foreground hidden sm:table-cell">{h.autor_nombre}</td>
                    <td className="py-2.5 text-right text-muted-foreground whitespace-nowrap">
                      {new Date(h.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── StepRow ─────────────────────────────────────────────────────────────────

function StepRow({ label, step }: { label: string; step: StepState }) {
  if (step.status === 'idle') return null

  const icon = {
    running: <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />,
    ok:      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />,
    error:   <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
    idle:    null,
  }[step.status]

  const textColor = {
    running: 'text-blue-600',
    ok:      'text-green-700',
    error:   'text-red-700',
    idle:    '',
  }[step.status]

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
        <span className={`text-sm ${textColor}`}>{step.message}</span>
      </div>
      {step.detail && (
        <p className="text-xs text-muted-foreground ml-6">{step.detail}</p>
      )}
    </div>
  )
}
