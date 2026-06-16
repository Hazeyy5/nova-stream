import { useEffect, useState } from 'react'
import './UpdateBanner.css'

interface UpdateState {
  status: string
  version?: string
  progress?: number
  message?: string
}

const VISIBLE_STATUSES = new Set(['available', 'downloading', 'downloaded'])

function shouldShow(state: UpdateState | null, dismissed: boolean): boolean {
  if (!state || dismissed) return false
  return VISIBLE_STATUSES.has(state.status)
}

export default function UpdateBanner() {
  const [state, setState] = useState<UpdateState | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    void window.novaStream.updates.getState().then((current) => {
      if (VISIBLE_STATUSES.has(current.status)) {
        setState(current)
        setDismissed(false)
      }
    })

    return window.novaStream.updates.onState((next) => {
      setState(next)
      if (VISIBLE_STATUSES.has(next.status)) {
        setDismissed(false)
      }
    })
  }, [])

  if (!shouldShow(state, dismissed)) return null

  const install = () => {
    void window.novaStream.updates.install()
  }

  return (
    <div className={`update-banner update-banner--${state!.status}`}>
      <div className="update-banner-text">
        {state!.status === 'downloaded' ? (
          <>
            <strong>Mise à jour {state!.version ?? ''} prête</strong>
            <span>Redémarrez l&apos;application pour l&apos;installer.</span>
          </>
        ) : state!.status === 'downloading' ? (
          <>
            <strong>Téléchargement de la mise à jour {state!.version ? `v${state!.version}` : ''}…</strong>
            <span>{state!.progress ?? 0} %</span>
            <div className="update-banner-progress">
              <div className="update-banner-progress-fill" style={{ width: `${state!.progress ?? 0}%` }} />
            </div>
          </>
        ) : (
          <>
            <strong>Nouvelle version disponible — v{state!.version ?? '?'}</strong>
            <span>{state!.message ?? 'Téléchargement en cours…'}</span>
          </>
        )}
      </div>
      <div className="update-banner-actions">
        {state!.status === 'downloaded' && (
          <button type="button" className="update-banner-btn primary" onClick={install}>
            Redémarrer et installer
          </button>
        )}
        {state!.status !== 'downloading' && (
          <button type="button" className="update-banner-btn ghost" onClick={() => setDismissed(true)}>
            Plus tard
          </button>
        )}
      </div>
    </div>
  )
}
