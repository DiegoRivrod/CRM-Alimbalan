import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, Users, UserSearch, Filter } from 'lucide-react'
import { useMapa } from '@/hooks/useMapa'
import { useAuth } from '@/lib/auth'
import { Link } from 'react-router-dom'

// Fix Leaflet icon paths rotos en Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const iconCliente = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

const iconProspecto = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

// Componente interno para re-centrar el mapa cuando cambian los pins
function MapBounds({ pins }: { pins: Array<{ lat: number; lng: number }> }) {
  const map = useMap()
  useEffect(() => {
    if (pins.length === 0) return
    const bounds = L.latLngBounds(pins.map(p => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 })
  }, [pins, map])
  return null
}

export default function MapaPage() {
  const { isAdmin, isSupervisor } = useAuth()
  const [filtroFuerza, setFiltroFuerza] = useState('')
  const [mostrar, setMostrar] = useState<'todos' | 'clientes' | 'prospectos'>('todos')

  const { pins, fuerzas, loading, error } = useMapa(filtroFuerza || undefined)

  const pinsFiltrados = useMemo(() => {
    if (mostrar === 'todos') return pins
    return pins.filter(p => p.tipo === mostrar.replace('s', '') as 'cliente' | 'prospecto')
  }, [pins, mostrar])

  // Evitar hydration issues: solo renderizar el mapa en el cliente
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const totalClientes   = pins.filter(p => p.tipo === 'cliente').length
  const totalProspectos = pins.filter(p => p.tipo === 'prospecto').length

  if (error) return <div className="text-red-500 text-sm">Error: {error}</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Mapa de clientes</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ubicación GPS de visitas registradas
          </p>
        </div>
        {/* KPIs rápidos */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">
            <Users className="w-4 h-4" />
            {totalClientes} clientes
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-sm font-medium">
            <UserSearch className="w-4 h-4" />
            {totalProspectos} prospectos
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filtro tipo */}
        <div className="flex border border-border rounded-lg overflow-hidden">
          {(['todos', 'clientes', 'prospectos'] as const).map(v => (
            <button
              key={v}
              onClick={() => setMostrar(v)}
              className={`px-3 py-1.5 text-sm transition-colors capitalize
                ${mostrar === v
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted'}`}
            >
              {v === 'todos' ? 'Todos' : v === 'clientes' ? 'Clientes' : 'Prospectos'}
            </button>
          ))}
        </div>

        {/* Filtro vendedor */}
        {(isAdmin || isSupervisor) && fuerzas.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filtroFuerza}
              onChange={e => setFiltroFuerza(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos los vendedores</option>
              {fuerzas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {pinsFiltrados.length} pines visibles
        </span>
      </div>

      {/* Mapa */}
      {loading ? (
        <div className="h-[600px] bg-muted animate-pulse rounded-xl flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Cargando mapa…</span>
        </div>
      ) : pinsFiltrados.length === 0 ? (
        <div className="h-[600px] bg-muted/30 rounded-xl border border-border flex flex-col items-center justify-center gap-3">
          <MapPin className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay visitas con GPS registradas</p>
          <p className="text-xs text-muted-foreground">Las visitas desde Google Forms incluyen coordenadas automáticamente</p>
        </div>
      ) : mounted ? (
        <div className="rounded-xl overflow-hidden border border-border h-[600px]">
          <MapContainer
            center={[-12.0, -77.0]}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBounds pins={pinsFiltrados} />
            {pinsFiltrados.map(pin => (
              <Marker
                key={pin.id}
                position={[pin.lat, pin.lng]}
                icon={pin.tipo === 'cliente' ? iconCliente : iconProspecto}
              >
                <Popup>
                  <div className="space-y-1 min-w-[180px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${pin.tipo === 'cliente' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {pin.tipo === 'cliente' ? 'Cliente' : 'Prospecto'}
                      </span>
                    </div>
                    <p className="font-semibold text-sm leading-tight">{pin.nombre}</p>
                    {pin.zona && <p className="text-xs text-gray-500">Zona: {pin.zona}</p>}
                    {pin.especie && <p className="text-xs text-gray-500">Especie: {pin.especie}</p>}
                    <p className="text-xs text-gray-500">Vendedor: {pin.fuerza_de_venta}</p>
                    <p className="text-xs text-gray-400">
                      Última visita: {new Date(pin.ultima_visita).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    {pin.tipo === 'cliente' && pin.idcliente && (
                      <Link
                        to={`/clientes/${pin.idcliente}`}
                        className="block mt-1.5 text-xs text-blue-600 hover:underline"
                      >
                        Ver ficha del cliente →
                      </Link>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      ) : null}

      {/* Leyenda */}
      {!loading && pinsFiltrados.length > 0 && (
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
            Clientes existentes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-orange-500" />
            Prospectos / clientes nuevos
          </span>
        </div>
      )}
    </div>
  )
}
