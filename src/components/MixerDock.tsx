import { useState } from 'react'
import type { StreamSettings } from '../types'
import { useAudioMeter, formatMeterDb, type AudioMeterReading } from '../hooks/useAudioMeter'
import './MixerDock.css'

interface MixerDockProps {
  settings: StreamSettings
  onUpdateSettings: (partial: Partial<StreamSettings>) => void
  onOpenSettings?: () => void
}

const METER_SEGMENTS = 48

function LevelMeterBars({ peak, rms }: { peak: number; rms: number }) {
  return (
    <div className="level-meter-stack">
      <LevelMeterRow level={peak} />
      <LevelMeterRow level={rms} />
    </div>
  )
}

function LevelMeterRow({ level }: { level: number }) {
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
}

function MixerChannel({
  label,
  deviceName,
  value,
  muted,
  meter,
  onVolumeChange,
  onMuteToggle,
  onOpenSettings
}: {
  label: string
  deviceName: string
  value: number
  muted: boolean
  meter: AudioMeterReading
  onVolumeChange: (v: number) => void
  onMuteToggle: () => void
  onOpenSettings?: () => void
}) {
  const active = !muted && !!deviceName
  const displayDb = active ? meter.displayDb : -60

  return (
    <div className="mixer-channel">
      <div className="mixer-channel-header">
        <span className="mixer-channel-label">{label}</span>
        <span className={`mixer-channel-db ${active && displayDb > -6 ? 'hot' : ''}`}>
          {formatMeterDb(displayDb, muted)}
        </span>
      </div>

      <LevelMeterBars peak={active ? meter.peak : 0} rms={active ? meter.rms : 0} />

      <div className="mixer-slider-row">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          disabled={muted}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="mixer-slider"
          style={{ '--vol': `${value}%` } as React.CSSProperties}
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
        {onOpenSettings && (
          <button type="button" className="mixer-icon-btn" onClick={onOpenSettings} title="Paramètres audio">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default function MixerDock({ settings, onUpdateSettings, onOpenSettings }: MixerDockProps) {
  const [desktopVol, setDesktopVol] = useState(80)

  const micMeter = useAudioMeter(
    settings.audioDevice,
    settings.audioEnabled,
    settings.audioVolume
  )

  const desktopMeter = useAudioMeter(
    settings.desktopAudioDevice,
    settings.desktopAudioEnabled,
    desktopVol
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
          value={desktopVol}
          muted={!settings.desktopAudioEnabled}
          meter={desktopMeter}
          onVolumeChange={setDesktopVol}
          onMuteToggle={() => onUpdateSettings({ desktopAudioEnabled: !settings.desktopAudioEnabled })}
          onOpenSettings={onOpenSettings}
        />
        <MixerChannel
          label="Mic/Aux"
          deviceName={settings.audioDevice}
          value={settings.audioVolume}
          muted={!settings.audioEnabled}
          meter={micMeter}
          onVolumeChange={(v) => onUpdateSettings({ audioVolume: v })}
          onMuteToggle={() => onUpdateSettings({ audioEnabled: !settings.audioEnabled })}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </div>
  )
}
