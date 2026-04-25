import { Component, ReactNode } from 'react'

interface Props {
  readonly children: ReactNode
}

interface State {
  readonly error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
          <div className="bg-red-950 border border-red-800 rounded-lg p-6 max-w-lg w-full space-y-3">
            <h2 className="text-red-300 font-semibold text-sm">Something went wrong</h2>
            <pre className="text-xs text-red-400 whitespace-pre-wrap break-all bg-red-900/30 rounded p-3 max-h-64 overflow-auto">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 bg-red-800 hover:bg-red-700 text-red-100 text-xs rounded transition-colors"
            >
              Dismiss and retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
