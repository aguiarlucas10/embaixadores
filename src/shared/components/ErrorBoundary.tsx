import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'Questrial, sans-serif',
          padding: '40px',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '14px', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px' }}>
            Algo deu errado
          </h1>
          <p style={{ fontSize: '13px', color: '#666', maxWidth: '400px', lineHeight: 1.6 }}>
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '24px',
              padding: '10px 32px',
              fontSize: '11px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              background: '#000',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Recarregar
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              marginTop: '32px',
              padding: '16px',
              background: '#f5f5f5',
              fontSize: '11px',
              textAlign: 'left',
              maxWidth: '600px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
