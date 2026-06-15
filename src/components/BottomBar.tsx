import { useEffect, useState } from 'react'
import type { MediaState, StreamSettings, VideoEncoder } from '../types'
import { IconLive, IconRecord } from './Icons'
import './BottomBar.css'

interface BottomBarProps {
  mediaState: MediaState
  settings: StreamSettings
  onStartStream: () => void
  onStartRecord: () => void
  onStartBoth: () => void
  onStopAll: () => void
  onOpenSettings: () => void
}

function formatDuration(startedAt?: number, now = Date.now()): string {
  if (!startedAt) return '00:00:00'
  const s = Math.floor((now - startedAt) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':')
}

const ENCODER_SHORT: Record<VideoEncoder, string> = {
  nvenc: 'NVENC',
  amf: 'AMF',
  qsv: 'QSV',
  x264: 'x264'
}

export default function BottomBar({
  mediaState,
  settings,
  onStartStream,
  onStartRecord,
  onStartBoth,
  onStopAll,
  onOpenSettings
}: BottomBarProps) {
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
    <footer className="bottom-bar">
      <div className="bottom-stats">
        <div className="stat-chip">
          <span className="stat-label">Résolution</span>
          <span className="stat-value">{settings.resolution}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-label">FPS</span>
          <span className="stat-value">{settings.framerate}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-label">Bitrate</span>
          <span className="stat-value">{settings.videoBitrate}k</span>
        </div>
        <div className="stat-chip">
          <span className="stat-label">Encodeur</span>
          <span className="stat-value">{ENCODER_SHORT[settings.encoder] ?? settings.encoder}</span>
        </div>
        {isLive && (
          <div className="stat-chip live">
            <span className="stat-label">Stream</span>
            <span className="stat-value">{formatDuration(mediaState.stream.startedAt, now)}</span>
          </div>
        )}
        {isRecording && (
          <div className="stat-chip record">
            <span className="stat-label">REC</span>
            <span className="stat-value">{formatDuration(mediaState.recording.startedAt, now)}</span>
          </div>
        )}
      </div>

      <div className="bottom-actions">
        {!canStream && !isActive && (
          <button className="config-link" onClick={onOpenSettings}>
            Configurer la clé de stream →
          </button>
        )}

        {isActive ? (
          <button className="action-btn stop-all" onClick={onStopAll} disabled={isBusy}>
            ■ Arrêter
          </button>
        ) : (
          <>
            <button
              className="action-btn record"
              onClick={onStartRecord}
              disabled={isBusy}
              title="Enregistrer localement"
            >
              <IconRecord size={10} />
              Enregistrer
            </button>
            <button
              className="action-btn stream"
              onClick={onStartStream}
              disabled={isBusy || !canStream}
              title="Démarrer le stream"
            >
              <IconLive size={10} />
              Stream
            </button>
            {canStream && (
              <button
                className="action-btn both"
                onClick={onStartBoth}
                disabled={isBusy}
                title="Stream + enregistrement simultané"
              >
                Stream + REC
              </button>
            )}
          </>
        )}
      </div>

      {mediaState.stream.message && mediaState.stream.status === 'error' && (
        <div className="bottom-error">{mediaState.stream.message}</div>
      )}
    </footer>
  )
}
