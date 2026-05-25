import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, TrendingUp, UserSearch,
  Activity, Upload, BarChart3, LogOut, Building2, Kanban, CheckSquare, Calendar, Trophy
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard, roles: ['gerente', 'supervisor', 'vendedor'] },
  { to: '/clientes',   label: 'Clientes',      icon: Users,           roles: ['gerente', 'supervisor', 'vendedor'] },
  { to: '/vendedores', label: 'Vendedores',    icon: TrendingUp,      roles: ['gerente', 'supervisor'] },
  { to: '/prospectos', label: 'Prospectos',    icon: UserSearch,      roles: ['gerente', 'supervisor', 'vendedor'] },
  { to: '/pipeline',   label: 'Pipeline',      icon: Kanban,          roles: ['gerente', 'supervisor', 'vendedor'] },
  { to: '/tareas',     label: 'Tareas',        icon: CheckSquare,     roles: ['gerente', 'supervisor', 'vendedor'] },
  { to: '/calendario', label: 'Calendario',    icon: Calendar,        roles: ['gerente', 'supervisor', 'vendedor'] },
  { to: '/visitas',    label: 'Actividad',     icon: Activity,        roles: ['gerente', 'supervisor', 'vendedor'] },
  { to: '/kpis',       label: 'KPIs',          icon: BarChart3,       roles: ['gerente', 'supervisor'] },
  { to: '/abal-plus',  label: 'ABAL+',         icon: Trophy,          roles: ['gerente', 'supervisor'] },
  { to: '/importar',   label: 'Importar datos',icon: Upload,          roles: ['gerente', 'supervisor'] },
] as const

export default function Sidebar() {
  const { profile, signOut } = useAuth()

  const visibleItems = navItems.filter(item =>
    profile?.rol && (item.roles as readonly string[]).includes(profile.rol)
  )

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
        <Building2 className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm text-foreground">CRM Comercial</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">
              {profile?.nombre?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.nombre}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile?.rol}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm
                     text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
