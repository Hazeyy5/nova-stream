import { useEffect, useState } from 'react'
import type { StreamSettings } from '../types'
import './MixerDock.css'

interface MixerDockProps {
  settings: StreamSettings
  onUpdateSettings: (partial: Partial<StreamSettings>) => void
}

function AudioMeter({ active }: { active: boolean }) {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!active) { setLevel(0); return }
    const id = setInterval(() => {
      setLevel(Math.random() * 0.6 + 0.15)
    }, 80)
    return () => clearInterval(id)
  }, [active])

  return (
    <div className="meter-bars">
      {Array.from({ length: 20 }, (_, i) => {
        const threshold = (i + 1) / 20
        const lit = active && level >= threshold
        const color = i >= 16 ? 'red' : i >= 12 ? 'yellow' : 'green'
        return <div key={i} className={`meter-bar ${lit ? `lit ${color}` : ''}`} />
      })}
    </div>
  )
}

function VolumeFader({
  label,
  value,
  muted,
  onVolumeChange,
  onMuteToggle
}: {
  label: string
  value: number
  muted: boolean
  onVolumeChange: (v: number) => void
  onMuteToggle: () => void
}) {
  return (
    <div className="fader-channel">
      <div className="fader-top">
        <span className="fader-label">{label}</span>
        <button
          className={`fader-mute ${muted ? 'muted' : ''}`}
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
      </div>
      <div className="fader-body">
        <AudioMeter active={!muted && value > 0} />
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          disabled={muted}
          orient="vertical"
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="fader-slider"
        />
      </div>
      <span className="fader-db">{muted ? 'MUTE' : `${value}%`}</span>
    </div>
  )
}

export default function MixerDock({ settings, onUpdateSettings }: MixerDockProps) {
  const [desktopVol, setDesktopVol] = useState(80)

  return (
    <div className="dock-panel mixer-dock">
      <div className="dock-panel-header">
        <h3>Table de mixage</h3>
      </div>
      <div className="mixer-faders">
        <VolumeFader
          label="Audio bureau"
          value={desktopVol}
          muted={!settings.desktopAudioEnabled}
          onVolumeChange={setDesktopVol}
          onMuteToggle={() => onUpdateSettings({ desktopAudioEnabled: !settings.desktopAudioEnabled })}
        />
        <VolumeFader
          label="Micro/Aux"
          value={settings.audioVolume}
          muted={!settings.audioEnabled}
          onVolumeChange={(v) => onUpdateSettings({ audioVolume: v })}
          onMuteToggle={() => onUpdateSettings({ audioEnabled: !settings.audioEnabled })}
        />
      </div>
    </div>
  )
}
