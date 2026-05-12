import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, UserSearch, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ResultadoCliente {
  tipo: 'cliente'
  id: string
  label: string
  sub: string
}

interface ResultadoProspecto {
  tipo: 'prospecto'
  id: string
  label: string
  sub: string
}

type Resultado = ResultadoCliente | ResultadoProspecto

// ── Hook de búsqueda con debounce ─────────────────────────────────────────────

function useBusquedaGlobal(query: string) {
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [buscando, setBuscando]     = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResultados([]); return }
    setBuscando(true)

    const [clientesRes, prospectosRes] = await Promise.all([
      supabase
        .from('clientes')
        .select('idcliente, nombre, responsable, zona')
        .or(`nombre.ilike.%${q}%,idcliente.ilike.%${q}%`)
        .limit(5),
      supabase
        .from('prospectos')
        .select('id, nombre, fuerza_de_venta, estado')
        .ilike('nombre', `%${q}%`)
        .in('estado', ['nuevo', 'seguimiento', 'convertido', 'perdido'])
        .limit(5),
    ])

    const clientes: Resultado[] = ((clientesRes.data ?? []) as {
      idcliente: string; nombre: string; responsable: string | null; zona: string | null
    }[]).map(c => ({
      tipo:  'cliente',
      id:    c.idcliente,
      label: c.nombre,
      sub:   [c.responsable, c.zona].filter(Boolean).join(' · ') || `#${c.idcliente}`,
    }))

    const prospectos: Resultado[] = ((prospectosRes.data ?? []) as {
      id: string; nombre: string; fuerza_de_venta: string; estado: string
    }[]).map(p => ({
      tipo:  'prospecto',
      id:    p.id,
      label: p.nombre,
      sub:   `${p.fuerza_de_venta} · ${p.estado}`,
    }))

    setResultados([...clientes, ...prospectos])
    setBuscando(false)
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(query), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, buscar])

  return { resultados, buscando }
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const [abierto,  setAbierto]  = useState(false)
  const [query,    setQuery]    = useState('')
  const [cursor,   setCursor]   = useState(-1)
  const inputRef  = useRef<HTMLInputElement>(null)
  const navigate  = useNavigate()

  const { resultados, buscando } = useBusquedaGlobal(query)

  // Ctrl+K para abrir
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setAbierto(true)
      }
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Foco al abrir
  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 50)
  }, [abierto])

  function cerrar() {
    setAbierto(false)
    setQuery('')
    setCursor(-1)
  }

  function navegar(r: Resultado) {
    cerrar()
    if (r.tipo === 'cliente')   navigate(`/clientes/${r.id}`)
    if (r.tipo === 'prospecto') navigate(`/prospectos/${r.id}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, resultados.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)) }
    if (e.key === 'Enter' && cursor >= 0 && resultados[cursor]) navegar(resultados[cursor])
    if (e.key === 'Escape') cerrar()
  }

  const clientes   = resultados.filter(r => r.tipo === 'cliente')
  const prospectos = resultados.filter(r => r.tipo === 'prospecto')

  // ── Trigger (botón siempre visible en el header) ───────────────────────────
  const trigger = (
    <button
      onClick={() => setAbierto(true)}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground
                 border border-border rounded-lg hover:bg-muted/40 transition-colors
                 min-w-[180px] sm:min-w-[220px]"
    >
      <Search className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1 text-left">Buscar…</span>
      <kbd className="hidden sm:inline text-xs bg-muted px-1.5 py-0.5 rounded font-mono">Ctrl K</kbd>
    </button>
  )

  if (!abierto) return trigger

  // ── Modal de búsqueda ──────────────────────────────────────────────────────
  return (
    <>
      {trigger}

      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={cerrar}
      />

      {/* Panel */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
        <div className="bg-white rounded-xl shadow-2xl border border-border overflow-hidden">

          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setCursor(-1) }}
              onKeyDown={handleKeyDown}
              placeholder="Buscar clientes o prospectos…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            {buscando && (
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
            )}
            <button onClick={cerrar} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Resultados */}
          {query.trim().length >= 2 && (
            <div className="max-h-80 overflow-y-auto py-2">
              {resultados.length === 0 && !buscando && (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin resultados para "{query}"</p>
              )}

              {clientes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Clientes</span>
                  </div>
                  {clientes.map(r => {
                    const idx = resultados.indexOf(r)
                    return (
                      <button
                        key={r.id}
                        onClick={() => navegar(r)}
                        className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                          cursor === idx ? 'bg-primary/5' : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.sub}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {prospectos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 py-1.5 mt-1">
                    <UserSearch className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prospectos</span>
                  </div>
                  {prospectos.map(r => {
                    const idx = resultados.indexOf(r)
                    return (
                      <button
                        key={r.id}
                        onClick={() => navegar(r)}
                        className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                          cursor === idx ? 'bg-primary/5' : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.sub}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Hint vacío */}
          {query.trim().length < 2 && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">Escribe al menos 2 caracteres para buscar</p>
              <p className="text-xs text-muted-foreground mt-1">Busca en clientes y prospectos simultáneamente</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border px-4 py-2 flex gap-4 text-xs text-muted-foreground">
            <span><kbd className="font-mono bg-muted px-1 rounded">↑↓</kbd> navegar</span>
            <span><kbd className="font-mono bg-muted px-1 rounded">Enter</kbd> abrir</span>
            <span><kbd className="font-mono bg-muted px-1 rounded">Esc</kbd> cerrar</span>
          </div>
        </div>
      </div>
    </>
  )
}
