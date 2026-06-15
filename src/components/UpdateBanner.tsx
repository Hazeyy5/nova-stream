import { useEffect, useState } from 'react'
import './UpdateBanner.css'

interface UpdateState {
  status: string
  version?: string
  progress?: number
  message?: string
}

export default function UpdateBanner() {
  const [state, setState] = useState<UpdateState | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    return window.novaStream.updates.onState((next) => {
      setState(next)
      if (next.status === 'downloaded' || next.status === 'available' || next.status === 'downloading') {
        setDismissed(false)
      }
    })
  }, [])

  if (!state || dismissed) return null
  if (state.status === 'idle' || state.status === 'checking') return null
  if (state.status === 'not-available' || state.status === 'error') return null

  const install = () => {
    void window.novaStream.updates.install()
  }

  return (
    <div className={`update-banner update-banner--${state.status}`}>
      <div className="update-banner-text">
        {state.status === 'downloaded' ? (
          <>
            <strong>Mise à jour {state.version ?? ''} prête</strong>
            <span>Redémarrez l&apos;application pour l&apos;installer.</span>
          </>
        ) : state.status === 'downloading' ? (
          <>
            <strong>Téléchargement de la mise à jour…</strong>
            <span>{state.progress ?? 0} %</span>
            <div className="update-banner-progress">
              <div className="update-banner-progress-fill" style={{ width: `${state.progress ?? 0}%` }} />
            </div>
          </>
        ) : (
          <>
            <strong>Mise à jour disponible</strong>
            <span>{state.message ?? `Version ${state.version ?? ''} en cours de téléchargement…`}</span>
          </>
        )}
      </div>
      <div className="update-banner-actions">
        {state.status === 'downloaded' && (
          <button type="button" className="update-banner-btn primary" onClick={install}>
            Redémarrer et installer
          </button>
        )}
        {state.status !== 'downloading' && (
          <button type="button" className="update-banner-btn ghost" onClick={() => setDismissed(true)}>
            Plus tard
          </button>
        )}
      </div>
    </div>
  )
}
