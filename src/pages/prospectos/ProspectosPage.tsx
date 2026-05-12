import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, UserSearch, Download, X, SlidersHorizontal } from 'lucide-react'
import { useProspectos, type EstadoProspecto } from '@/hooks/useProspectos'
import { useAuth } from '@/lib/auth'
import { exportarProspectos } from '@/lib/exportar'

// ── Helpers visuales ─────────────────────────────────────────────────────────

const ESTADOS: { value: EstadoProspecto | 'todos'; label: string }[] = [
  { value: 'todos',       label: 'Todos'       },
  { value: 'nuevo',       label: 'Nuevos'      },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'convertido',  label: 'Convertidos' },
  { value: 'perdido',     label: 'Perdidos'    },
]

const BADGE: Record<string, string> = {
  nuevo:       'bg-blue-100 text-blue-700',
  seguimiento: 'bg-yellow-100 text-yellow-700',
  convertido:  'bg-green-100 text-green-700',
  perdido:     'bg-red-100 text-red-600',
}

const ESTADO_LABEL: Record<string, string> = {
  nuevo:       'Nuevo',
  seguimiento: 'Seguimiento',
  convertido:  'Convertido',
  perdido:     'Perdido',
}

function BadgeEstado({ estado }: { estado: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[estado] ?? 'bg-muted text-muted-foreground'}`}>
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  )
}

function BadgeMatch({ aprobado, confianza }: { aprobado: boolean; confianza: number | null }) {
  if (aprobado) return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      Match ✓
    </span>
  )
  if (confianza !== null) return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
      Sugerido {Math.round(confianza * 100)}%
    </span>
  )
  return <span className="text-muted-foreground text-xs">—</span>
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function ProspectosPage() {
  const { isSupervisor, isAdmin } = useAuth()
  const navigate   = useNavigate()

  const [tabEstado,    setTabEstado]   = useState<EstadoProspecto | 'todos'>('todos')
  const [filtroFuerza, setFuerza]      = useState('')
  const [filtroZona,   setFiltroZona]  = useState('')
  const [filtroEspecie,setFiltroEspecie] = useState('')
  const [filtroMatch,  setFiltroMatch] = useState('')   // '' | 'aprobado' | 'sugerido' | 'sin'
  const [busqueda,     setBusqueda]    = useState('')

  // Cargamos TODOS siempre (para contadores y listas de filtros)
  const { prospectos: todos, loading, error } = useProspectos('todos')

  // Listas de opciones derivadas del dataset
  const fuerzas  = useMemo(() => [...new Set(todos.map(p => p.fuerza_de_venta))].sort(), [todos])
  const zonas    = useMemo(() => [...new Set(todos.map(p => p.zona).filter(Boolean))].sort() as string[], [todos])
  const especies = useMemo(() => [...new Set(todos.map(p => p.especie).filter(Boolean))].sort() as string[], [todos])

  // Filtrado client-side: estado + fuerza + zona + especie + match + búsqueda
  const visibles = useMemo(() => {
    return todos.filter(p => {
      if (tabEstado !== 'todos' && p.estado !== tabEstado) return false
      if (filtroFuerza  && p.fuerza_de_venta !== filtroFuerza) return false
      if (filtroZona    && p.zona !== filtroZona)              return false
      if (filtroEspecie && p.especie !== filtroEspecie)        return false
      if (filtroMatch === 'aprobado' && !p.match_aprobado)     return false
      if (filtroMatch === 'sugerido' && (p.match_aprobado || p.match_confianza === null)) return false
      if (filtroMatch === 'sin'      && p.match_confianza !== null) return false
      if (busqueda.trim() && !p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())) return false
      return true
    })
  }, [todos, tabEstado, filtroFuerza, filtroZona, filtroEspecie, filtroMatch, busqueda])

  // Contadores por estado (siempre sobre la lista completa sin filtro de tab)
  const conteoEstado = useMemo(() => todos.reduce<Record<string, number>>((acc, p) => {
    acc[p.estado] = (acc[p.estado] ?? 0) + 1
    return acc
  }, {}), [todos])

  // Chips de filtros activos (excepto tab y búsqueda)
  type Chip = { label: string; limpiar: () => void }
  const chipsActivos = useMemo((): Chip[] => {
    const chips: Chip[] = []
    if (filtroFuerza)  chips.push({ label: filtroFuerza,  limpiar: () => setFuerza('') })
    if (filtroZona)    chips.push({ label: filtroZona,    limpiar: () => setFiltroZona('') })
    if (filtroEspecie) chips.push({ label: filtroEspecie, limpiar: () => setFiltroEspecie('') })
    if (filtroMatch === 'aprobado') chips.push({ label: 'Match aprobado', limpiar: () => setFiltroMatch('') })
    if (filtroMatch === 'sugerido') chips.push({ label: 'Match sugerido', limpiar: () => setFiltroMatch('') })
    if (filtroMatch === 'sin')      chips.push({ label: 'Sin match',      limpiar: () => setFiltroMatch('') })
    return chips
  }, [filtroFuerza, filtroZona, filtroEspecie, filtroMatch])

  function limpiarTodo() {
    setFuerza(''); setFiltroZona(''); setFiltroEspecie(''); setFiltroMatch(''); setBusqueda('')
  }

  if (error) return <div className="text-red-500 text-sm">Error: {error}</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Prospectos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Clientes potenciales captados en visitas de campo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserSearch className="w-4 h-4" />
            {visibles.length} de {todos.length} prospectos
          </span>
          <button
            onClick={() => exportarProspectos(visibles)}
            disabled={loading || visibles.length === 0}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors border border-border rounded-lg px-3 py-1.5"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Tabs de estado */}
      <div className="flex gap-1 border-b border-border">
        {ESTADOS.map(e => {
          const count = e.value === 'todos'
            ? Object.values(conteoEstado).reduce((a, b) => a + b, 0)
            : (conteoEstado[e.value] ?? 0)
          return (
            <button
              key={e.value}
              onClick={() => setTabEstado(e.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tabEstado === e.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {e.label}
              {count > 0 && (
                <span className="ml-1.5 bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-xs">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />

          <input
            type="text"
            placeholder="Buscar por nombre…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm w-52 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {(isAdmin || isSupervisor) && (
            <select
              value={filtroFuerza}
              onChange={e => setFuerza(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos los vendedores</option>
              {fuerzas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          )}

          <select
            value={filtroZona}
            onChange={e => setFiltroZona(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todas las zonas</option>
            {zonas.map(z => <option key={z} value={z}>{z}</option>)}
          </select>

          <select
            value={filtroEspecie}
            onChange={e => setFiltroEspecie(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todas las especies</option>
            {especies.map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          <select
            value={filtroMatch}
            onChange={e => setFiltroMatch(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todos los match</option>
            <option value="aprobado">Match aprobado</option>
            <option value="sugerido">Match sugerido</option>
            <option value="sin">Sin match</option>
          </select>

          {chipsActivos.length > 0 && (
            <button
              onClick={limpiarTodo}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Limpiar todo
            </button>
          )}
        </div>

        {/* Chips de filtros activos */}
        {chipsActivos.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {chipsActivos.map(chip => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium"
              >
                {chip.label}
                <button onClick={chip.limpiar} className="hover:text-primary/60 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Cargando prospectos…</div>
      ) : visibles.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No hay prospectos en este estado.
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Vendedor</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Zona</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Especie</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Potencial (tn)</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">Match</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Fecha</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map(p => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/prospectos/${p.id}`)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">{p.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[160px] truncate">
                    {p.fuerza_de_venta}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{p.zona ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{p.especie ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                    {p.potencial_tn != null ? p.potencial_tn.toLocaleString('es-PE') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <BadgeEstado estado={p.estado} />
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <BadgeMatch aprobado={p.match_aprobado} confianza={p.match_confianza} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {new Date(p.created_at).toLocaleDateString('es-PE')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
