import type { Source, StreamSettings } from '../types'
import { MAX_GAIN_DB, MIN_GAIN_DB, resolveMicGainDb } from '../lib/audioGain'
import './AudioMixer.css'

interface AudioMixerProps {
  sources: Source[]
  settings: StreamSettings
  onUpdateSource: (id: string, partial: Partial<Source>) => void
  onUpdateSettings: (partial: Partial<StreamSettings>) => void
}

export default function AudioMixer({
  sources,
  settings,
  onUpdateSource,
  onUpdateSettings
}: AudioMixerProps) {
  const audioSources = sources.filter((s) => s.type === 'webcam' || s.type === 'display')

  return (
    <div className="audio-mixer">
      <h4>Mixeur audio</h4>

      <div className="mixer-channel">
        <div className="mixer-channel-header">
          <span>🎤 Micro</span>
          <button
            className={`mixer-mute ${!settings.audioEnabled ? 'muted' : ''}`}
            onClick={() => onUpdateSettings({ audioEnabled: !settings.audioEnabled })}
          >
            {settings.audioEnabled ? 'ON' : 'MUT'}
          </button>
        </div>
        <input
          type="range" min={MIN_GAIN_DB} max={MAX_GAIN_DB} step={0.5}
          value={resolveMicGainDb(settings)}
          disabled={!settings.audioEnabled}
          onChange={(e) => onUpdateSettings({ audioGainDb: Number(e.target.value) })}
          className="mixer-slider"
        />
      </div>

      <div className="mixer-channel">
        <div className="mixer-channel-header">
          <span>🔊 Audio bureau</span>
          <button
            className={`mixer-mute ${!settings.desktopAudioEnabled ? 'muted' : ''}`}
            onClick={() => onUpdateSettings({ desktopAudioEnabled: !settings.desktopAudioEnabled })}
          >
            {settings.desktopAudioEnabled ? 'ON' : 'MUT'}
          </button>
        </div>
        <div className="mixer-hint">Capture le son système via DirectShow</div>
      </div>

      {audioSources.map((src) => (
        <div key={src.id} className="mixer-channel">
          <div className="mixer-channel-header">
            <span>{src.name}</span>
            <button
              className={`mixer-mute ${src.muted ? 'muted' : ''}`}
              onClick={() => onUpdateSource(src.id, { muted: !src.muted })}
            >
              {src.muted ? 'MUT' : 'ON'}
            </button>
          </div>
          <input
            type="range" min={0} max={100}
            value={src.volume}
            disabled={src.muted}
            onChange={(e) => onUpdateSource(src.id, { volume: Number(e.target.value) })}
            className="mixer-slider"
          />
          <span className="mixer-value">{src.volume}%</span>
        </div>
      ))}
    </div>
  )
}
