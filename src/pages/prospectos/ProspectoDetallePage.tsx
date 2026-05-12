import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, ChevronDown } from 'lucide-react'
import {
  useProspectoDetalle,
  aprobarMatch, rechazarMatch, cambiarEstado,
  buscarClientesSimilares,
  type EstadoProspecto, type ClienteSimilar,
} from '@/hooks/useProspectos'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import ActividadTimeline from '@/components/actividad/ActividadTimeline'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BADGE: Record<string, string> = {
  nuevo:       'bg-blue-100 text-blue-700',
  seguimiento: 'bg-yellow-100 text-yellow-700',
  convertido:  'bg-green-100 text-green-700',
  perdido:     'bg-red-100 text-red-600',
}

const ESTADOS_SIGUIENTE: Record<EstadoProspecto, EstadoProspecto[]> = {
  nuevo:       ['seguimiento', 'perdido'],
  seguimiento: ['convertido', 'perdido'],
  convertido:  [],
  perdido:     ['nuevo'],
}

function FilaDato({ label, valor }: { label: string; valor?: string | number | null }) {
  if (valor == null || valor === '') return null
  return (
    <div className="flex justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{String(valor)}</span>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ProspectoDetallePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isSupervisor, isAdmin } = useAuth()

  const { prospecto, loading, error, recargar } = useProspectoDetalle(id ?? '')

  const [guardando,       setGuardando]       = useState(false)
  const [mensajeAccion,   setMensajeAccion]   = useState<string | null>(null)
  const [clientesBusqueda, setClientesBusqueda] = useState<ClienteSimilar[]>([])
  const [queryBusqueda,   setQueryBusqueda]   = useState('')
  const [cargandoClientes, setCargandoClientes] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteSimilar | null>(null)
  const [mostrarCambioEstado, setMostrarCambioEstado] = useState(false)

  // Sugerencia automática al cargar (si no tiene match todavía)
  useEffect(() => {
    if (!prospecto || prospecto.match_aprobado) return
    if (prospecto.idcliente_sugerido) return // ya tiene sugerencia guardada

    async function sugerirAutomatico() {
      setCargandoClientes(true)
      const { data } = await supabase
        .from('clientes')
        .select('idcliente, nombre, departamento, zona, responsable')
        .eq('status', 'ACTIVO')
      if (data && prospecto) {
        const similares = buscarClientesSimilares(prospecto.nombre, data)
        setClientesBusqueda(similares)
      }
      setCargandoClientes(false)
    }
    sugerirAutomatico()
  }, [prospecto])

  // Búsqueda manual de clientes
  async function buscarManual() {
    if (!queryBusqueda.trim()) return
    setCargandoClientes(true)
    const { data } = await supabase
      .from('clientes')
      .select('idcliente, nombre, departamento, zona, responsable')
      .ilike('nombre', `%${queryBusqueda}%`)
      .limit(10)
    if (data) {
      setClientesBusqueda(
        (data as Array<{ idcliente: string; nombre: string; departamento: string | null; zona: string | null; responsable: string | null }>)
          .map(c => ({ ...c, similitud: 0 }))
      )
    }
    setCargandoClientes(false)
  }

  async function handleAprobar(cliente: ClienteSimilar) {
    if (!prospecto || !user?.id) return
    setGuardando(true)
    const { error } = await aprobarMatch(
      prospecto.id,
      cliente.idcliente,
      cliente.similitud,
      user.id
    )
    setMensajeAccion(error ? `Error: ${error}` : 'Match aprobado correctamente.')
    setGuardando(false)
    if (!error) recargar()
  }

  async function handleRechazar() {
    if (!prospecto) return
    setGuardando(true)
    const { error } = await rechazarMatch(prospecto.id)
    setMensajeAccion(error ? `Error: ${error}` : 'Match eliminado.')
    setGuardando(false)
    if (!error) { recargar(); setClientesBusqueda([]) }
  }

  async function handleCambiarEstado(estado: EstadoProspecto) {
    if (!prospecto) return
    setGuardando(true)
    const { error } = await cambiarEstado(prospecto.id, estado)
    setMensajeAccion(error ? `Error: ${error}` : `Estado cambiado a "${estado}".`)
    setGuardando(false)
    setMostrarCambioEstado(false)
    if (!error) recargar()
  }

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Cargando…</div>
  if (error || !prospecto) return <div className="text-red-500 text-sm">Error: {error ?? 'No encontrado'}</div>

  const esSupervisor = isSupervisor || isAdmin
  const siguientes   = ESTADOS_SIGUIENTE[prospecto.estado]

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Barra superior */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Prospectos
        </button>
      </div>

      {/* Header del prospecto */}
      <div className="bg-white border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{prospecto.nombre}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{prospecto.fuerza_de_venta}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${BADGE[prospecto.estado]}`}>
              {prospecto.estado.charAt(0).toUpperCase() + prospecto.estado.slice(1)}
            </span>
            {esSupervisor && siguientes.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setMostrarCambioEstado(v => !v)}
                  className="flex items-center gap-1 text-xs border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
                >
                  Cambiar <ChevronDown className="w-3 h-3" />
                </button>
                {mostrarCambioEstado && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg z-10 overflow-hidden min-w-[130px]">
                    {siguientes.map(e => (
                      <button
                        key={e}
                        onClick={() => handleCambiarEstado(e)}
                        disabled={guardando}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        → {e.charAt(0).toUpperCase() + e.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-0 text-sm pt-2 border-t border-border">
          <FilaDato label="Contacto"          valor={prospecto.contacto} />
          <FilaDato label="Zona"              valor={prospecto.zona} />
          <FilaDato label="Especie"           valor={prospecto.especie} />
          <FilaDato label="Potencial (tn)"    valor={prospecto.potencial_tn} />
          <FilaDato label="Marcas que consume" valor={prospecto.marcas_consume} />
          <FilaDato label="Registrado"        valor={new Date(prospecto.created_at).toLocaleDateString('es-PE')} />
        </div>
      </div>

      {/* Visita de origen */}
      {prospecto.visita && (
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-3">Visita de origen</h3>
          <div className="grid grid-cols-2 gap-x-6 text-sm">
            <FilaDato label="Fecha"            valor={new Date(prospecto.visita.marca_temporal).toLocaleDateString('es-PE')} />
            <FilaDato label="Localización"     valor={prospecto.visita.localizacion} />
            <FilaDato label="Tipo cliente"     valor={prospecto.visita.tipo_cliente} />
            <FilaDato label="Animales"         valor={prospecto.visita.animales} />
            <FilaDato label="Granjas"          valor={prospecto.visita.granjas} />
            <FilaDato label="Líneas interés"   valor={prospecto.visita.lineas_productos} />
            <FilaDato label="Procedencia"      valor={prospecto.visita.procedencia} />
            <FilaDato label="Problema abastec." valor={prospecto.visita.problema_abastecimiento} />
          </div>
        </div>
      )}

      {/* Sección de Match */}
      <div className="bg-white border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-sm">Match con cliente existente</h3>

        {/* Match ya aprobado */}
        {prospecto.match_aprobado && prospecto.cliente_sugerido ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
            <div>
              <p className="text-sm font-medium text-green-800">{prospecto.cliente_sugerido.nombre}</p>
              <p className="text-xs text-green-600 mt-0.5">
                {prospecto.cliente_sugerido.departamento} · {prospecto.cliente_sugerido.responsable}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aprobado el {prospecto.match_aprobado_at
                  ? new Date(prospecto.match_aprobado_at).toLocaleDateString('es-PE')
                  : '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              {esSupervisor && (
                <button
                  onClick={handleRechazar}
                  disabled={guardando}
                  className="text-xs text-red-500 hover:text-red-700 underline"
                >
                  Revocar
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Sugerencias automáticas */}
            {clientesBusqueda.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {queryBusqueda ? 'Resultados de búsqueda:' : 'Clientes similares encontrados automáticamente:'}
                </p>
                {clientesBusqueda.map(c => (
                  <div
                    key={c.idcliente}
                    onClick={() => setClienteSeleccionado(prev => prev?.idcliente === c.idcliente ? null : c)}
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                      clienteSeleccionado?.idcliente === c.idcliente
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.departamento ?? '—'} · {c.responsable ?? '—'}
                      </p>
                    </div>
                    {c.similitud > 0 && (
                      <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                        {Math.round(c.similitud * 100)}% similar
                      </span>
                    )}
                  </div>
                ))}

                {clienteSeleccionado && esSupervisor && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleAprobar(clienteSeleccionado)}
                      disabled={guardando}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aprobar match
                    </button>
                    <button
                      onClick={() => setClienteSeleccionado(null)}
                      className="flex items-center gap-1.5 border border-border text-sm px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}

            {cargandoClientes && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" /> Buscando clientes similares…
              </div>
            )}

            {/* Búsqueda manual */}
            {esSupervisor && (
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Buscar cliente por nombre…"
                  value={queryBusqueda}
                  onChange={e => setQueryBusqueda(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarManual()}
                  className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={buscarManual}
                  disabled={cargandoClientes}
                  className="border border-border rounded-lg px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Buscar
                </button>
              </div>
            )}

            {!esSupervisor && clientesBusqueda.length === 0 && !cargandoClientes && (
              <p className="text-sm text-muted-foreground">Sin match asignado todavía.</p>
            )}
          </>
        )}

        {mensajeAccion && (
          <p className={`text-sm mt-2 ${mensajeAccion.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
            {mensajeAccion}
          </p>
        )}
      </div>

      {/* Conversión */}
      {prospecto.estado === 'convertido' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h3 className="font-semibold text-sm text-green-800 mb-2">Prospecto convertido</h3>
          <FilaDato label="Primera factura" valor={prospecto.primera_factura_docventa} />
          <FilaDato label="Fecha conversión" valor={
            prospecto.fecha_conversion
              ? new Date(prospecto.fecha_conversion).toLocaleDateString('es-PE')
              : undefined
          } />
        </div>
      )}

      {/* Timeline de actividad */}
      <ActividadTimeline prospecto_id={id} />
    </div>
  )
}
