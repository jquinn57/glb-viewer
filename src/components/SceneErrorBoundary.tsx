import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  onError?: (error: Error) => void
  fallback?: ReactNode
}

type State = {
  error: Error | null
}

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GLB viewer] Scene rendering failed', error, info)
    this.props.onError?.(error)
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="viewer-message viewer-message--error" role="alert">
          <span className="eyebrow">Rendering error</span>
          <h2>The scene could not be loaded.</h2>
          <p>{this.state.error.message}</p>
          <p className="muted">
            Confirm that the GLB and HDR files are valid browser-readable assets.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
