import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MacroDesi crashed:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.assign('/')
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-xl font-bold text-slate-800">Something went wrong</h1>
          <p className="max-w-sm text-sm text-slate-500">
            MacroDesi hit an unexpected error. Your logged data is safe on this device — try
            reloading.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-2 rounded bg-brand-600 px-4 py-2 font-medium text-white"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
