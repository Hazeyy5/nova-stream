import { useEffect, useState } from 'react'
import type { MediaState, StreamSettings } from '../types'
import './ActionBar.css'

interface ActionBarProps {
  mediaState: MediaState
  settings: StreamSettings
  onGoLive: () => void
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

export default function ActionBar({
  mediaState,
  settings,
  onGoLive,
  onStartRecord,
  onStopAll,
  onOpenSettings,
  onTestAlert
}: ActionBarProps) {
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
    <footer className="action-bar">
      <div className="action-bar-left">
        <span className="stream-info-item">{settings.resolution} · {settings.framerate}fps · {settings.videoBitrate}k</span>
        {isLive && (
          <span className="stream-timer live">
            ● EN DIRECT {formatDuration(mediaState.stream.startedAt, now)}
          </span>
        )}
        {isRecording && (
          <span className="stream-timer record">
            ● REC {formatDuration(mediaState.recording.startedAt, now)}
          </span>
        )}
        {mediaState.stream.status === 'error' && (
          <span className="stream-error">{mediaState.stream.message}</span>
        )}
      </div>

      <div className="action-bar-right">
        {onTestAlert && !isActive && (
          <button className="btn-test-widgets" onClick={onTestAlert} title="Tester les widgets">
            Tester les widgets
          </button>
        )}

        {!canStream && !isActive && (
          <button className="setup-hint" onClick={onOpenSettings}>
            ⚙ Configurer le stream
          </button>
        )}

        {isActive ? (
          <button className="btn-stop" onClick={onStopAll} disabled={isBusy}>
            ■ Arrêter
          </button>
        ) : (
          <>
            <button className="btn-record" onClick={onStartRecord} disabled={isBusy} title="Enregistrer">
              <span className="rec-dot" />
              REC
            </button>
            <button
              className="btn-go-live"
              onClick={onGoLive}
              disabled={isBusy || !canStream}
              title="Diffuser en direct"
            >
              Diffuser en direct
            </button>
          </>
        )}
      </div>
    </footer>
  )
}
