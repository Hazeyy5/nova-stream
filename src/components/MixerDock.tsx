import { memo, useEffect, useState } from 'react'
import type { AudioChannelId, StreamSettings } from '../types'
import { useAudioMeter } from '../hooks/useAudioMeter'
import { useDesktopAudioMeter } from '../hooks/useDesktopAudioMeter'
import { useStreamAudioMeter } from '../hooks/useStreamAudioMeter'
import { useMicMonitor } from '../hooks/useMicMonitor'
import {
  formatGainDb,
  gainDbToSliderPercent,
  MAX_GAIN_DB,
  MIN_GAIN_DB,
  parseGainDb,
  resolveDesktopGainDb,
  resolveMicGainDb
} from '../lib/audioGain'
import type { AudioMeterReading } from '../hooks/useAudioMeter'
import { hookAudioContextResume, ensureAudioContextRunning } from '../lib/micMeterEngine'
import './MixerDock.css'

interface MixerDockProps {
  settings: StreamSettings
  isMediaActive: boolean
  onUpdateSettings: (partial: Partial<StreamSettings>) => void
  onOpenSettings?: () => void
}

const METER_SEGMENTS = 48

function openChannelProperties(channel: AudioChannelId, settings: StreamSettings) {
  window.novaStream.audioProps.open(channel, settings)
}

const LevelMeterBars = memo(function LevelMeterBars({
  peak,
  rms,
  muted = false
}: {
  peak: number
  rms: number
  muted?: boolean
}) {
  return (
    <div className={`level-meter-stack${muted ? ' level-meter-muted' : ''}`}>
      <LevelMeterRow level={peak} />
      <LevelMeterRow level={rms} />
    </div>
  )
})

const LevelMeterRow = memo(function LevelMeterRow({ level }: { level: number }) {
  const litCount = Math.round(level * METER_SEGMENTS)
  return (
    <div className="level-meter-row" role="meter" aria-valuenow={Math.round(level * 100)}>
      {Array.from({ length: METER_SEGMENTS }, (_, i) => {
        const lit = i < litCount
        const ratio = (i + 1) / METER_SEGMENTS
        const zone = ratio > 0.88 ? 'red' : ratio > 0.72 ? 'yellow' : 'green'
        return (
          <div
            key={i}
            className={`level-meter-seg ${lit ? `lit ${zone}` : ''}`}
          />
        )
      })}
    </div>
  )
}, (prev, next) => Math.abs(prev.level - next.level) < 0.003)

function MixerChannel({
  label,
  deviceName,
  gainDb,
  muted,
  meter,
  onGainChange,
  onMuteToggle,
  onOpenProperties,
  onToggleMonitor,
  monitorOn
}: {
  label: string
  deviceName: string
  gainDb: number
  muted: boolean
  meter: AudioMeterReading
  onGainChange: (db: number) => void
  onMuteToggle: () => void
  onOpenProperties?: () => void
  onToggleMonitor?: () => void
  monitorOn?: boolean
}) {
  const [localGainDb, setLocalGainDb] = useState(gainDb)

  useEffect(() => {
    setLocalGainDb(gainDb)
  }, [gainDb])

  const handleGainInput = (raw: string) => {
    const db = parseGainDb(Number(raw))
    setLocalGainDb(db)
    onGainChange(db)
  }

  const wakeAudio = () => {
    void ensureAudioContextRunning()
  }

  return (
    <div className="mixer-channel">
      <div className="mixer-channel-header">
        <button
          type="button"
          className="mixer-channel-label-btn"
          onClick={onOpenProperties}
          title="Propriétés"
        >
          <span className="mixer-channel-label">{label}</span>
          {deviceName && (
            <span className="mixer-channel-device">{deviceName}</span>
          )}
        </button>
        <span className="mixer-channel-db">
          {formatGainDb(localGainDb, muted)}
        </span>
      </div>

      <LevelMeterBars
        peak={meter.peak}
        rms={meter.rms}
        muted={muted}
      />

      <div className="mixer-slider-row">
        <input
          type="range"
          min={MIN_GAIN_DB}
          max={MAX_GAIN_DB}
          step={0.5}
          value={localGainDb}
          onPointerDown={wakeAudio}
          onInput={(e) => handleGainInput(e.currentTarget.value)}
          onChange={(e) => handleGainInput(e.currentTarget.value)}
          className="mixer-slider"
          style={{ '--vol': gainDbToSliderPercent(localGainDb) } as React.CSSProperties}
        />
        <button
          type="button"
          className={`mixer-icon-btn ${muted ? 'muted' : ''}`}
          onClick={onMuteToggle}
          title={muted ? 'Activer' : 'Couper'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {muted ? (
              <>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : (
              <>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
              </>
            )}
          </svg>
        </button>
        {onToggleMonitor && (
          <button
            type="button"
            className={`mixer-icon-btn ${monitorOn ? 'monitor-on' : ''}`}
            onClick={onToggleMonitor}
            title={monitorOn ? 'Couper le retour voix' : 'Retour voix — écouter comme sur le stream'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 18v-6a9 9 0 0118 0v6" />
              <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5z" />
              <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" />
            </svg>
          </button>
        )}
        {onOpenProperties && (
          <button type="button" className="mixer-icon-btn" onClick={onOpenProperties} title="Propriétés">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default function MixerDock({ settings, isMediaActive, onUpdateSettings, onOpenSettings }: MixerDockProps) {
  const [micMonitor, setMicMonitor] = useState(false)
  const micGainDb = resolveMicGainDb(settings)
  const desktopGainDb = resolveDesktopGainDb(settings)

  useEffect(() => {
    hookAudioContextResume()
  }, [])

  const idleMicMeter = useAudioMeter(
    settings.audioDevice,
    !isMediaActive && !!settings.audioDevice,
    micGainDb,
    settings.micMono ?? false
  )
  const idleDesktopMeter = useDesktopAudioMeter(!isMediaActive && !!settings.desktopAudioDevice, desktopGainDb)
  const streamMicMeter = useStreamAudioMeter(isMediaActive, 'mic', micGainDb)
  const streamDesktopMeter = useStreamAudioMeter(isMediaActive, 'desktop', desktopGainDb)

  const micMeter = isMediaActive ? streamMicMeter : idleMicMeter
  const desktopMeter = isMediaActive ? streamDesktopMeter : idleDesktopMeter
  useMicMonitor(
    settings.audioDevice,
    settings.audioEnabled,
    micGainDb,
    micMonitor,
    settings.micMono ?? false
  )

  return (
    <div className="dock-panel mixer-dock">
      <div className="dock-panel-header">
        <h3>Table de mixage</h3>
        {onOpenSettings && (
          <button type="button" className="dock-add-btn" onClick={onOpenSettings} title="Paramètres audio">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        )}
      </div>
      <div className="mixer-channels">
        <MixerChannel
          label="Desktop Audio"
          deviceName={settings.desktopAudioDevice}
          gainDb={desktopGainDb}
          muted={!settings.desktopAudioEnabled}
          meter={desktopMeter}
          onGainChange={(db) => onUpdateSettings({ desktopAudioGainDb: db, desktopAudioVolume: undefined })}
          onMuteToggle={() => onUpdateSettings({ desktopAudioEnabled: !settings.desktopAudioEnabled })}
          onOpenProperties={() => openChannelProperties('desktop', settings)}
        />
        <MixerChannel
          label="Mic/Aux"
          deviceName={settings.audioDevice}
          gainDb={micGainDb}
          muted={!settings.audioEnabled}
          meter={micMeter}
          onGainChange={(db) => onUpdateSettings({ audioGainDb: db, audioVolume: undefined })}
          onMuteToggle={() => onUpdateSettings({ audioEnabled: !settings.audioEnabled })}
          onOpenProperties={() => openChannelProperties('mic', settings)}
          onToggleMonitor={() => setMicMonitor((v) => !v)}
          monitorOn={micMonitor}
        />
      </div>
    </div>
  )
}
