import { useEffect, useState } from 'react'
import type { MediaState, StreamSettings } from '../types'
import './ControlsDock.css'

interface ControlsDockProps {
  mediaState: MediaState
  settings: StreamSettings
  onGoLive: () => void
  onEditLiveInfo?: () => void
  onStartRecord: () => void
  onStopAll: () => void
  onOpenSettings: () => void
  onTestAlert?: () => void
}

function formatDuration(startedAt?: number, now = Date.now()): string {
  if (!startedAt) return '00:00:00'
  const s = Math.floor((now - startedAt) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':')
}

export default function ControlsDock({
  mediaState,
  settings,
  onGoLive,
  onEditLiveInfo,
  onStartRecord,
  onStopAll,
  onOpenSettings,
  onTestAlert
}: ControlsDockProps) {
  const [now, setNow] = useState(Date.now())
  const isLive = mediaState.stream.status === 'live'
  const isRecording = mediaState.recording.status === 'recording'
  const isBusy = ['starting', 'stopping'].includes(mediaState.stream.status)
  const canStream = settings.streamKey.trim().length > 0
  const isActive = isLive || isRecording || isBusy

  useEffect(() => {
    if (!isLive && !isRecording) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isLive, isRecording])

  return (
    <div className="dock-panel controls-dock">
      <div className="dock-panel-header">
        <h3>Contrôles</h3>
      </div>
      <div className="controls-dock-body">
        {(isLive || isRecording) && (
          <div className="controls-dock-timers">
            {isLive && (
              <>
                <span className="controls-timer live">
                  ● EN DIRECT {formatDuration(mediaState.stream.startedAt, now)}
                </span>
                {settings.streamTitle && (
                  <span className="controls-live-title" title={settings.streamTitle}>
                    {settings.streamTitle}
                  </span>
                )}
              </>
            )}
            {isRecording && (
              <span className="controls-timer record">
                ● REC {formatDuration(mediaState.recording.startedAt, now)}
              </span>
            )}
          </div>
        )}

        {mediaState.stream.status === 'error' && (
          <p className="controls-error">{mediaState.stream.message}</p>
        )}

        {isActive ? (
          <>
            {isLive && (
              <>
                {onEditLiveInfo && (
                  <button
                    type="button"
                    className="controls-btn controls-btn-secondary"
                    onClick={onEditLiveInfo}
                    disabled={isBusy}
                  >
                    Modifier le live
                  </button>
                )}
                <button className="controls-btn controls-btn-stop-stream" onClick={onStopAll} disabled={isBusy}>
                  Arrêter le stream
                </button>
              </>
            )}
            {isRecording && (
              <button className="controls-btn controls-btn-stop-rec" onClick={onStopAll} disabled={isBusy}>
                Arrêter l&apos;enregistrement
              </button>
            )}
            {!isLive && !isRecording && (
              <button className="controls-btn controls-btn-stop" onClick={onStopAll} disabled={isBusy}>
                Arrêter
              </button>
            )}
          </>
        ) : (
          <>
            <button
              className="controls-btn controls-btn-live"
              onClick={onGoLive}
              disabled={isBusy || !canStream}
            >
              Diffuser en direct
            </button>
            <button className="controls-btn controls-btn-rec" onClick={onStartRecord} disabled={isBusy}>
              <span className="rec-dot" />
              Enregistrer
            </button>
          </>
        )}

        {!canStream && !isActive && (
          <button className="controls-btn controls-btn-secondary" onClick={onOpenSettings}>
            Configurer le stream
          </button>
        )}

        {onTestAlert && !isActive && (
          <button className="controls-btn controls-btn-secondary" onClick={onTestAlert}>
            Tester les widgets
          </button>
        )}

        <button className="controls-btn controls-btn-secondary" onClick={onOpenSettings}>
          Paramètres
        </button>
      </div>
    </div>
  )
}
