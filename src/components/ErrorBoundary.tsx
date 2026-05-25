import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Render personalizado en lugar del fallback por defecto. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Atrapa errores de render/ciclo de vida en el árbol hijo y muestra un fallback.
 * No atrapa errores asíncronos (handlers de fetch, promises) — esos deben manejarse
 * en cada hook con try/catch + estado de error.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // En producción esto va a la consola; en una iteración futura se puede
    // enviar a Sentry / Logflare / etc.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
      return <DefaultFallback error={this.state.error} onReset={this.reset} />
    }
    return this.props.children
  }
}

function DefaultFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-md border border-red-200 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-slate-900">Algo salió mal</h1>
            <p className="text-sm text-slate-600 mt-1">
              La aplicación encontró un error inesperado. Puedes intentar recargar la sección
              o volver al inicio.
            </p>
            <pre className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 overflow-auto max-h-32">
              {error.message}
            </pre>
            <div className="mt-4 flex gap-2">
              <button
                onClick={onReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
              <a
                href="/"
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
              >
                Ir al inicio
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
