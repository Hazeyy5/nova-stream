import { Component, type ErrorInfo, type ReactNode } from 'react'
import LoadingScreen from './LoadingScreen'

interface Props {
  children: ReactNode
}

interface State {
  error: string | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(err: Error): State {
    return { error: err.message || 'Erreur inattendue' }
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    console.error('[Nova Stream]', err, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <LoadingScreen
          error={this.state.error}
          onRetry={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}
