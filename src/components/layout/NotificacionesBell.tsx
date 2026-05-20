import { useState, useRef, useEffect } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotificaciones } from '@/hooks/useNotificaciones'
import type { Notificacion } from '@/types/supabase'
import NotificacionItem from './NotificacionItem'

export default function NotificacionesBell() {
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const {
    notificaciones,
    loading,
    conteoNoLeidas,
    marcarLeida,
    marcarTodasLeidas,
  } = useNotificaciones()

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  const handleClick = async (notif: Notificacion) => {
    if (!notif.leida) await marcarLeida(notif.id)
    setAbierto(false)
    if (notif.link) navigate(notif.link)
  }

  const handleMarcarTodas = async () => {
    await marcarTodasLeidas()
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setAbierto(v => !v)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {conteoNoLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center
                           bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
            {conteoNoLeidas > 99 ? '99+' : conteoNoLeidas}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {abierto && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h4 className="font-semibold text-sm">Notificaciones</h4>
            {conteoNoLeidas > 0 && (
              <button
                onClick={handleMarcarTodas}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Marcar todas leídas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-border/50">
            {loading ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">Cargando…</p>
              </div>
            ) : notificaciones.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin notificaciones</p>
              </div>
            ) : (
              notificaciones.map(n => (
                <NotificacionItem key={n.id} notificacion={n} onClick={handleClick} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
