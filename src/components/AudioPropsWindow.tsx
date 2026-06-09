import { useEffect, useState } from 'react'
import type { AudioChannelId, AudioChannelPropsPayload, MediaDevice, StreamSettings } from '../types'
import './SourceInspector.css'
import './SettingsModal.css'

const CHANNEL_LABELS: Record<AudioChannelId, string> = {
  mic: 'Mic/Aux',
  desktop: 'Desktop Audio'
}

const CHANNEL_HINTS: Record<AudioChannelId, string> = {
  mic: 'Entrée microphone — utilisée pour votre voix dans le stream.',
  desktop: 'Sortie son du PC — capture le son des jeux, musique et applications.'
}

export default function AudioPropsWindow() {
  const [payload, setPayload] = useState<AudioChannelPropsPayload | null>(null)
  const [devices, setDevices] = useState<MediaDevice[]>([])
  const [devicesLoading, setDevicesLoading] = useState(true)

  const loadDevices = () => {
    setDevicesLoading(true)
    window.novaStream.devices.listMedia()
      .then(setDevices)
      .finally(() => setDevicesLoading(false))
  }

  useEffect(() => {
    document.body.classList.add('source-props-page')
    loadDevices()
    return () => document.body.classList.remove('source-props-page')
  }, [])

  useEffect(() => {
    const applyPayload = (next: AudioChannelPropsPayload) => {
      setPayload((prev) => {
        if (!prev || prev.channel !== next.channel) return next
        return { channel: next.channel, settings: { ...prev.settings, ...next.settings } }
      })
    }

    const unsubs = [
      window.novaStream.audioProps.onInit(applyPayload),
      window.novaStream.audioProps.onSync(applyPayload)
    ]
    window.novaStream.audioProps.ready()
    return () => unsubs.forEach((u) => u())
  }, [])

  if (!payload) {
    return <div className="source-props-window-loading">Chargement…</div>
  }

  const { channel, settings } = payload
  const patch = (partial: Partial<StreamSettings>) => {
    setPayload((prev) => prev ? { ...prev, settings: { ...prev.settings, ...partial } } : prev)
    window.novaStream.audioProps.patch(partial)
  }

  const micDevices = devices.filter((d) => d.type === 'audio' && d.audioRole === 'input')
  const desktopDevices = devices.filter(
    (d) => d.type === 'audio' && (d.audioRole === 'output' || d.audioRole === 'loopback')
  )
  const hasNativeDesktop = devices.some(
    (d) => d.type === 'audio' && d.audioRole === 'output' && d.backend === 'native'
  )

  return (
    <div className="source-props-window">
      <header className="source-props-window-header">
        <h1>Propriétés — {CHANNEL_LABELS[channel]}</h1>
        <span className="source-props-window-type">{CHANNEL_HINTS[channel]}</span>
      </header>

      <div className="source-props-scroll">
        <div className="source-props-panel source-props-body">
          <div className="settings-devices-bar audio-props-devices-bar">
            <span>
              {devicesLoading
                ? 'Détection des périphériques…'
                : channel === 'mic'
                  ? `${micDevices.length} micro(s) détecté(s)`
                  : `${desktopDevices.length} sortie(s) détectée(s)`}
            </span>
            <button type="button" className="settings-refresh-btn" onClick={loadDevices} disabled={devicesLoading}>
              Actualiser
            </button>
          </div>

          {channel === 'mic' ? (
            <>
              <label className="inspector-field">
                <span className="inspector-field-label">Activer le microphone</span>
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.audioEnabled}
                    onChange={(e) => patch({ audioEnabled: e.target.checked })}
                  />
                  Microphone actif
                </label>
              </label>

              <label className="inspector-field">
                <span className="inspector-field-label">Périphérique d&apos;entrée</span>
                <select
                  value={settings.audioDevice}
                  onChange={(e) => patch({ audioDevice: e.target.value })}
                  disabled={!settings.audioEnabled || devicesLoading}
                >
                  <option value="">— Sélectionner —</option>
                  {micDevices.map((d) => (
                    <option key={d.name + (d.deviceId ?? '')} value={d.name}>
                      {d.name}{d.isDefault ? ' (par défaut)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              {!devicesLoading && micDevices.length === 0 && (
                <p className="settings-hint warn">Aucun microphone détecté.</p>
              )}

              <label className="inspector-field">
                <span className="inspector-field-label">Mode audio</span>
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.micMono ?? false}
                    disabled={!settings.audioEnabled}
                    onChange={(e) => patch({ micMono: e.target.checked })}
                  />
                  Mono (canal central)
                </label>
              </label>
              <p className="settings-hint">
                Dirige l&apos;audio vers le canal central plutôt que vers les canaux stéréo gauche ou droit.
                Utile pour les interfaces stéréo (ex. Focusrite « Analogue 1 + 2 »).
              </p>

              <label className="inspector-field">
                <span className="inspector-field-label">Bitrate audio (kbps)</span>
                <input
                  type="number"
                  min={64}
                  max={320}
                  value={settings.audioBitrate}
                  disabled={!settings.audioEnabled}
                  onChange={(e) => patch({ audioBitrate: Number(e.target.value) })}
                />
              </label>
            </>
          ) : (
            <>
              <label className="inspector-field">
                <span className="inspector-field-label">Activer Desktop Audio</span>
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.desktopAudioEnabled}
                    onChange={(e) => patch({ desktopAudioEnabled: e.target.checked })}
                  />
                  Capturer le son du PC
                </label>
              </label>

              <label className="inspector-field">
                <span className="inspector-field-label">Périphérique de sortie</span>
                <select
                  value={settings.desktopAudioDevice}
                  onChange={(e) => patch({ desktopAudioDevice: e.target.value })}
                  disabled={!settings.desktopAudioEnabled || devicesLoading}
                >
                  <option value="">— Sélectionner —</option>
                  {desktopDevices.map((d) => (
                    <option key={d.name + (d.deviceId ?? '')} value={d.name}>
                      {d.name}{d.isDefault ? ' (par défaut)' : ''}{d.audioRole === 'loopback' ? ' · capture' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <p className="settings-hint">
                {hasNativeDesktop
                  ? 'Capture WASAPI automatique — comme Streamlabs, sans Stereo Mix.'
                  : 'Sélectionnez les haut-parleurs ou le casque dont vous voulez capturer le son.'}
              </p>

              {!devicesLoading && desktopDevices.length === 0 && (
                <p className="settings-hint warn">
                  Aucune sortie détectée. Vérifiez vos pilotes audio puis cliquez Actualiser.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <footer className="source-props-footer">
        <button type="button" className="source-props-close-btn" onClick={() => window.close()}>
          Fermer
        </button>
      </footer>
    </div>
  )
}
