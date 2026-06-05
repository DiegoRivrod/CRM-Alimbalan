import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'
import { queryClient } from '@/lib/queryClient'
import ErrorBoundary from '@/components/ErrorBoundary'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ClientesPage from '@/pages/clientes/ClientesPage'
import ClienteDetallePage from '@/pages/clientes/ClienteDetallePage'
import VendedoresPage from '@/pages/vendedores/VendedoresPage'
import VendedorDetallePage from '@/pages/vendedores/VendedorDetallePage'
import ProspectosPage from '@/pages/prospectos/ProspectosPage'
import ProspectoDetallePage from '@/pages/prospectos/ProspectoDetallePage'
import KanbanPage from '@/pages/prospectos/KanbanPage'
import TareasPage from '@/pages/tareas/TareasPage'
import CalendarioPage from '@/pages/calendario/CalendarioPage'
import VisitasPage from '@/pages/VisitasPage'
import KpisPage from '@/pages/kpis/KpisPage'
import AbalPlusDashboard from '@/pages/abal-plus/AbalPlusDashboard'
import ImportarPage from '@/pages/importar/ImportarPage'
import MapaPage from '@/pages/mapa/MapaPage'
import CarteraPage from '@/pages/cartera/CarteraPage'

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"         element={<DashboardPage />} />
              <Route path="/clientes"          element={<ClientesPage />} />
              <Route path="/clientes/:id"      element={<ClienteDetallePage />} />
              <Route path="/prospectos"        element={<ProspectosPage />} />
              <Route path="/prospectos/:id"    element={<ProspectoDetallePage />} />
              <Route path="/pipeline"          element={<KanbanPage />} />
              <Route path="/tareas"            element={<TareasPage />} />
              <Route path="/calendario"        element={<CalendarioPage />} />
              <Route path="/visitas"           element={<VisitasPage />} />
              <Route path="/mapa"              element={<MapaPage />} />
              <Route path="/cartera"           element={<CarteraPage />} />

              <Route path="/vendedores" element={
                <ProtectedRoute roles={['gerente', 'supervisor']}>
                  <VendedoresPage />
                </ProtectedRoute>
              } />
              <Route path="/vendedores/:id" element={
                <ProtectedRoute roles={['gerente', 'supervisor']}>
                  <VendedorDetallePage />
                </ProtectedRoute>
              } />
              <Route path="/kpis" element={
                <ProtectedRoute roles={['gerente', 'supervisor']}>
                  <KpisPage />
                </ProtectedRoute>
              } />
              <Route path="/abal-plus" element={
                <ProtectedRoute roles={['gerente', 'supervisor']}>
                  <AbalPlusDashboard />
                </ProtectedRoute>
              } />
              <Route path="/importar" element={
                <ProtectedRoute roles={['gerente', 'supervisor']}>
                  <ImportarPage />
                </ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
