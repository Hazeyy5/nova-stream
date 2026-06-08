import { useState, useEffect } from 'react'
import type { StreamSettings, MediaDevice } from '../types'
import './SettingsModal.css'

interface SettingsModalProps {
  settings: StreamSettings
  onSave: (settings: StreamSettings) => void
  onClose: () => void
}

const PLATFORMS = [
  { name: 'Twitch', url: 'rtmp://live.twitch.tv/app' },
  { name: 'YouTube', url: 'rtmp://a.rtmp.youtube.com/live2' },
  { name: 'Kick', url: 'rtmps://fa723fc1b171.global-contribute.live-video.net/app' },
  { name: 'Personnalisé', url: '' }
]

const TABS = ['Stream', 'Vidéo', 'Audio', 'Enregistrement', 'Avancé'] as const
type Tab = typeof TABS[number]

const RESOLUTIONS = ['1920x1080', '1280x720', '2560x1440', '854x480']

export default function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [form, setForm] = useState<StreamSettings>({ ...settings })
  const [tab, setTab] = useState<Tab>('Stream')
  const [devices, setDevices] = useState<MediaDevice[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState(() => {
    const match = PLATFORMS.find((p) => p.url === settings.rtmpUrl)
    return match?.name ?? 'Personnalisé'
  })

  useEffect(() => {
    window.novaStream.devices.listMedia().then(setDevices)
  }, [])

  const audioDevices = devices.filter((d) => d.type === 'audio')
  const videoDevices = devices.filter((d) => d.type === 'video')

  const update = (partial: Partial<StreamSettings>) => {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  const handlePlatformChange = (name: string) => {
    setSelectedPlatform(name)
    const platform = PLATFORMS.find((p) => p.name === name)
    if (platform?.url) update({ rtmpUrl: platform.url })
  }

  const pickRecordingFolder = async () => {
    const folder = await window.novaStream.dialog.selectRecordingFolder()
    if (folder) update({ recordingPath: folder })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Paramètres</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`settings-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {tab === 'Stream' && (
            <>
              <fieldset className="settings-group">
                <legend>Plateforme</legend>
                <div className="platform-buttons">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.name}
                      className={`platform-btn ${selectedPlatform === p.name ? 'active' : ''}`}
                      onClick={() => handlePlatformChange(p.name)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="settings-field">
                URL RTMP
                <input value={form.rtmpUrl} onChange={(e) => update({ rtmpUrl: e.target.value })} />
              </label>
              <label className="settings-field">
                Clé de stream
                <input
                  type="password"
                  value={form.streamKey}
                  onChange={(e) => update({ streamKey: e.target.value })}
                  placeholder="Clé secrète"
                />
              </label>
            </>
          )}

          {tab === 'Vidéo' && (
            <>
              <div className="settings-grid">
                <label className="settings-field">
                  Résolution
                  <select value={form.resolution} onChange={(e) => update({ resolution: e.target.value })}>
                    {RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="settings-field">
                  FPS
                  <select value={form.framerate} onChange={(e) => update({ framerate: Number(e.target.value) })}>
                    <option value={30}>30</option>
                    <option value={60}>60</option>
                  </select>
                </label>
                <label className="settings-field">
                  Bitrate vidéo (kbps)
                  <input type="number" value={form.videoBitrate} min={500} max={20000}
                    onChange={(e) => update({ videoBitrate: Number(e.target.value) })} />
                </label>
                <label className="settings-field">
                  Encodeur
                  <select value={form.encoder} onChange={(e) => update({ encoder: e.target.value as StreamSettings['encoder'] })}>
                    <option value="x264">CPU (x264)</option>
                    <option value="nvenc">NVIDIA NVENC</option>
                  </select>
                </label>
              </div>
              <label className="settings-field">
                Webcam
                <select value={form.webcamDevice} onChange={(e) => update({ webcamDevice: e.target.value })}>
                  <option value="">— Sélectionner —</option>
                  {videoDevices.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </label>
            </>
          )}

          {tab === 'Audio' && (
            <>
              <label className="settings-checkbox">
                <input type="checkbox" checked={form.audioEnabled}
                  onChange={(e) => update({ audioEnabled: e.target.checked })} />
                Activer le microphone
              </label>
              <label className="settings-field">
                Microphone
                <select value={form.audioDevice} onChange={(e) => update({ audioDevice: e.target.value })}
                  disabled={!form.audioEnabled}>
                  <option value="">— Sélectionner —</option>
                  {audioDevices.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </label>
              <label className="settings-field">
                Bitrate audio (kbps)
                <input type="number" value={form.audioBitrate} min={64} max={320}
                  disabled={!form.audioEnabled}
                  onChange={(e) => update({ audioBitrate: Number(e.target.value) })} />
              </label>
              <hr className="settings-hr" />
              <label className="settings-checkbox">
                <input type="checkbox" checked={form.desktopAudioEnabled}
                  onChange={(e) => update({ desktopAudioEnabled: e.target.checked })} />
                Capturer l'audio du bureau
              </label>
              <label className="settings-field">
                Périphérique audio bureau
                <select value={form.desktopAudioDevice}
                  onChange={(e) => update({ desktopAudioDevice: e.target.value })}
                  disabled={!form.desktopAudioEnabled}>
                  <option value="">— Sélectionner —</option>
                  {audioDevices.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </label>
            </>
          )}

          {tab === 'Enregistrement' && (
            <>
              <label className="settings-checkbox">
                <input type="checkbox" checked={form.recordingEnabled}
                  onChange={(e) => update({ recordingEnabled: e.target.checked })} />
                Activer l'enregistrement local
              </label>
              <label className="settings-field">
                Dossier de sortie
                <div className="folder-picker">
                  <input value={form.recordingPath} readOnly placeholder="~/Videos/NovaStream (par défaut)" />
                  <button type="button" onClick={pickRecordingFolder}>Parcourir</button>
                </div>
              </label>
              <p className="settings-hint">
                Les fichiers sont enregistrés au format MP4. Utilisez « Stream + REC » pour streamer et enregistrer simultanément.
              </p>
            </>
          )}

          {tab === 'Avancé' && (
            <>
              <label className="settings-field">
                Transition entre scènes
                <select value={form.transition}
                  onChange={(e) => update({ transition: e.target.value as StreamSettings['transition'] })}>
                  <option value="cut">Coupe directe</option>
                  <option value="fade">Fondu</option>
                </select>
              </label>
              <label className="settings-field">
                Durée du fondu (ms)
                <input type="number" value={form.transitionDuration} min={100} max={2000}
                  disabled={form.transition === 'cut'}
                  onChange={(e) => update({ transitionDuration: Number(e.target.value) })} />
              </label>
              <p className="settings-hint">
                {devices.length} périphérique(s) détecté(s) via DirectShow.
              </p>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-btn secondary" onClick={onClose}>Annuler</button>
          <button className="modal-btn primary" onClick={() => onSave(form)}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}
