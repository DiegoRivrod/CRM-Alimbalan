import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import type { Rol } from '@/types/supabase'

interface Props {
  children: React.ReactNode
  roles?: Rol[]  // si se especifica, solo esos roles pueden acceder
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (roles?.length) {
    if (!profile)
      return <Navigate to="/dashboard" replace />
    if (!roles.includes(profile.rol)) return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
