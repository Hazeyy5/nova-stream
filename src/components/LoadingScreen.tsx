import logoUrl from '../assets/logo.png'
import './LoadingScreen.css'

interface LoadingScreenProps {
  message?: string
  error?: string | null
  onRetry?: () => void
}

export default function LoadingScreen({ message, error, onRetry }: LoadingScreenProps) {
  const hasError = Boolean(error)

  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-screen-card">
        <img className="loading-screen-logo" src={logoUrl} alt="" width={72} height={72} />
        <h1 className="loading-screen-title">Nova Stream</h1>

        {hasError ? (
          <>
            <p className="loading-screen-error">{error}</p>
            {onRetry && (
              <button type="button" className="loading-screen-retry" onClick={onRetry}>
                Réessayer
              </button>
            )}
          </>
        ) : (
          <>
            <div className="loading-screen-spinner" aria-hidden="true" />
            <p className="loading-screen-message">{message ?? 'Chargement…'}</p>
          </>
        )}
      </div>
    </div>
  )
}
