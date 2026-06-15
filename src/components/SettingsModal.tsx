import { useState, useEffect } from 'react'
import type { SceneCollection, StreamSettings, MediaDevice, SpeedtestResult } from '../types'
import { SCENE_TEMPLATES, type SceneTemplateId } from '../lib/sceneTemplates'
import './SettingsModal.css'

interface SettingsModalProps {
  settings: StreamSettings
  onSave: (settings: StreamSettings) => void
  onClose: () => void
  twitchConnected?: boolean
  onFetchTwitchStreamKey?: () => Promise<string | null>
  isMediaActive?: boolean
  onLiveChange?: (partial: Partial<StreamSettings>) => void
  collections?: SceneCollection[]
  activeCollectionName?: string
  onExportScenes?: () => void
  onExportAllCollections?: () => void
  onImportScenes?: () => void
  onApplyTemplate?: (templateId: SceneTemplateId, mode: 'replace' | 'new') => void
}

const PLATFORMS = [
  { name: 'Twitch', url: 'rtmp://live.twitch.tv/app' },
  { name: 'YouTube', url: 'rtmp://a.rtmp.youtube.com/live2' },
  { name: 'Kick', url: 'rtmps://fa723fc1b171.global-contribute.live-video.net/app' },
  { name: 'Personnalisé', url: '' }
]

const TABS = ['Stream', 'Vidéo', 'Audio', 'Enregistrement', 'Scènes', 'Avancé'] as const
type Tab = typeof TABS[number]

const RESOLUTIONS = ['1920x1080', '1280x720', '2560x1440', '854x480']

const QUALITY_LABELS: Record<SpeedtestResult['quality'], string> = {
  excellent: 'Excellente',
  good: 'Bonne',
  fair: 'Limite',
  poor: 'Insuffisante'
}

export default function SettingsModal({
  settings,
  onSave,
  onClose,
  twitchConnected = false,
  onFetchTwitchStreamKey,
  isMediaActive = false,
  onLiveChange,
  collections = [],
  activeCollectionName = 'Collection',
  onExportScenes,
  onExportAllCollections,
  onImportScenes,
  onApplyTemplate
}: SettingsModalProps) {
  const [form, setForm] = useState<StreamSettings>({ ...settings })
  const [tab, setTab] = useState<Tab>('Stream')
  const [selectedTemplate, setSelectedTemplate] = useState<SceneTemplateId>('gaming')
  const [fetchingKey, setFetchingKey] = useState(false)
  const [devices, setDevices] = useState<MediaDevice[]>([])
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [speedtestRunning, setSpeedtestRunning] = useState(false)
  const [speedtestProgress, setSpeedtestProgress] = useState(0)
  const [speedtestResult, setSpeedtestResult] = useState<SpeedtestResult | null>(null)
  const [speedtestError, setSpeedtestError] = useState<string | null>(null)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState(() => {
    const match = PLATFORMS.find((p) => p.url === settings.rtmpUrl)
    return match?.name ?? 'Personnalisé'
  })

  const loadDevices = () => {
    setDevicesLoading(true)
    window.novaStream.devices.listMedia()
      .then(setDevices)
      .finally(() => setDevicesLoading(false))
  }

  useEffect(() => {
    loadDevices()
    const unsub = window.novaStream.updates.onState((state) => {
      if (state.message && state.status !== 'checking' && state.status !== 'downloading') {
        setUpdateMessage(state.message)
      }
    })
    return unsub
  }, [])

  const micDevices = devices.filter(
    (d) => d.type === 'audio' && d.audioRole === 'input'
  )
  const desktopDevices = devices.filter(
    (d) => d.type === 'audio' && (d.audioRole === 'output' || d.audioRole === 'loopback')
  )
  const outputDevices = devices.filter((d) => d.type === 'audio' && d.audioRole === 'output')
  const hasNativeDesktop = outputDevices.some((d) => d.backend === 'native')
  const videoDevices = devices.filter((d) => d.type === 'video')

  const update = (partial: Partial<StreamSettings>) => {
    setForm((prev) => ({ ...prev, ...partial }))
    if (isMediaActive) {
      onLiveChange?.(partial)
    }
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

  const runSpeedtest = async () => {
    setSpeedtestRunning(true)
    setSpeedtestProgress(0)
    setSpeedtestResult(null)
    setSpeedtestError(null)

    const unsubscribe = window.novaStream.speedtest.onProgress(setSpeedtestProgress)

    try {
      const result = await window.novaStream.speedtest.run(
        form.resolution,
        form.framerate,
        form.audioEnabled ? form.audioBitrate : 0
      )
      setSpeedtestResult(result)
    } catch (err) {
      setSpeedtestError(err instanceof Error ? err.message : 'Test impossible')
    } finally {
      unsubscribe()
      setSpeedtestRunning(false)
    }
  }

  const applyRecommendedBitrate = () => {
    if (speedtestResult) update({ videoBitrate: speedtestResult.recommendedVideoBitrate })
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
                <div className="settings-inline-row">
                  <input
                    type="password"
                    value={form.streamKey}
                    onChange={(e) => update({ streamKey: e.target.value })}
                    placeholder="Clé secrète"
                  />
                  {twitchConnected && onFetchTwitchStreamKey && (
                    <button
                      type="button"
                      className="settings-inline-btn"
                      disabled={fetchingKey}
                      onClick={async () => {
                        setFetchingKey(true)
                        try {
                          const key = await onFetchTwitchStreamKey()
                          if (key) update({ streamKey: key, rtmpUrl: 'rtmp://live.twitch.tv/app' })
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Erreur')
                        } finally {
                          setFetchingKey(false)
                        }
                      }}
                    >
                      {fetchingKey ? '…' : 'Twitch'}
                    </button>
                  )}
                </div>
              </label>
              {twitchConnected && (
                <p className="settings-hint">
                  Connecté à Twitch — récupérez automatiquement votre clé de stream.
                </p>
              )}
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

              <div className="speedtest-panel">
                <div className="speedtest-header">
                  <div>
                    <strong>Test de connexion</strong>
                    <p>Mesure votre débit montant et propose un bitrate adapté à {form.resolution} · {form.framerate} fps.</p>
                  </div>
                  <button
                    type="button"
                    className="speedtest-btn"
                    onClick={runSpeedtest}
                    disabled={speedtestRunning}
                  >
                    {speedtestRunning ? 'Test en cours…' : 'Lancer le test'}
                  </button>
                </div>

                {speedtestRunning && (
                  <div className="speedtest-progress">
                    <div className="speedtest-progress-bar" style={{ width: `${speedtestProgress}%` }} />
                  </div>
                )}

                {speedtestError && (
                  <p className="speedtest-error">{speedtestError}</p>
                )}

                {speedtestResult && (
                  <div className={`speedtest-result quality-${speedtestResult.quality}`}>
                    <div className="speedtest-stats">
                      <div>
                        <span className="speedtest-stat-label">Upload mesuré</span>
                        <span className="speedtest-stat-value">{speedtestResult.uploadMbps} Mbps</span>
                      </div>
                      <div>
                        <span className="speedtest-stat-label">Bitrate recommandé</span>
                        <span className="speedtest-stat-value accent">{speedtestResult.recommendedVideoBitrate} kbps</span>
                      </div>
                      <div>
                        <span className="speedtest-stat-label">Qualité</span>
                        <span className="speedtest-stat-value">{QUALITY_LABELS[speedtestResult.quality]}</span>
                      </div>
                    </div>
                    <p className="speedtest-message">{speedtestResult.message}</p>
                    {speedtestResult.recommendedVideoBitrate !== form.videoBitrate && (
                      <button type="button" className="speedtest-apply" onClick={applyRecommendedBitrate}>
                        Appliquer {speedtestResult.recommendedVideoBitrate} kbps
                      </button>
                    )}
                  </div>
                )}
              </div>

              <label className="settings-field">
                Webcam (entrée vidéo)
                <select value={form.webcamDevice} onChange={(e) => update({ webcamDevice: e.target.value })}>
                  <option value="">— Sélectionner —</option>
                  {videoDevices.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </label>
              {!devicesLoading && videoDevices.length === 0 && (
                <p className="settings-hint warn">
                  Aucune webcam détectée. Cliquez « Actualiser » dans l&apos;onglet Audio ou redémarrez l&apos;app.
                </p>
              )}
            </>
          )}

          {tab === 'Audio' && (
            <>
              <div className="settings-devices-bar">
                <span>
                  {devicesLoading
                    ? 'Détection des périphériques…'
                    : `${micDevices.length} micro(s) · ${outputDevices.length} sortie(s)`}
                </span>
                <button type="button" className="settings-refresh-btn" onClick={loadDevices} disabled={devicesLoading}>
                  Actualiser
                </button>
              </div>

              <label className="settings-checkbox">
                <input type="checkbox" checked={form.audioEnabled}
                  onChange={(e) => update({ audioEnabled: e.target.checked })} />
                Activer le microphone
              </label>
              <label className="settings-field">
                Microphone (entrée)
                <select value={form.audioDevice} onChange={(e) => update({ audioDevice: e.target.value })}
                  disabled={!form.audioEnabled || devicesLoading}>
                  <option value="">— Sélectionner —</option>
                  {micDevices.map((d) => <option key={d.name + (d.deviceId ?? '')} value={d.name}>{d.name}</option>)}
                </select>
              </label>
              {!devicesLoading && micDevices.length === 0 && (
                <p className="settings-hint warn">Aucun microphone détecté.</p>
              )}
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
                Capturer l&apos;audio du bureau (Desktop Audio)
              </label>
              <label className="settings-field">
                Sortie son (Desktop Audio)
                <select value={form.desktopAudioDevice}
                  onChange={(e) => update({ desktopAudioDevice: e.target.value })}
                  disabled={!form.desktopAudioEnabled || devicesLoading}>
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
                  ? 'Capture WASAPI automatique — aucun pilote virtuel requis, comme Streamlabs.'
                  : 'Les haut-parleurs et casques apparaissent ici. La capture du son du PC utilise WASAPI sous Windows.'}
              </p>
              {!devicesLoading && desktopDevices.length === 0 && (
                <p className="settings-hint warn">
                  Aucune sortie détectée. Vérifiez vos pilotes audio puis cliquez Actualiser.
                </p>
              )}
              <hr className="settings-hr" />
              <label className="settings-field">
                Décalage audio / vidéo
                <div className="settings-sync-row">
                  <input
                    type="range"
                    min={-1000}
                    max={5000}
                    step={50}
                    value={form.audioSyncOffsetMs ?? 3000}
                    onChange={(e) => update({ audioSyncOffsetMs: Number(e.target.value) })}
                  />
                  <span>{form.audioSyncOffsetMs ?? 3000} ms</span>
                </div>
              </label>
              <p className="settings-hint">
                Si le son est en avance sur l&apos;image, augmentez la valeur (ex. 3000 ms). S&apos;il est en retard, diminuez-la.
                {isMediaActive && ' Le réglage s&apos;applique pendant le live (reconnexion brève du flux).'}
              </p>
            </>
          )}

          {tab === 'Enregistrement' && (
            <>
              <label className="settings-checkbox">
                <input type="checkbox" checked={form.recordingEnabled}
                  onChange={(e) => update({ recordingEnabled: e.target.checked })} />
                Activer l'enregistrement local
              </label>
              <label className="settings-checkbox">
                <input type="checkbox" checked={form.recordAudioEnabled}
                  onChange={(e) => update({ recordAudioEnabled: e.target.checked })} />
                Inclure l'audio dans l'enregistrement
              </label>
              <label className="settings-field">
                Dossier de sortie
                <div className="folder-picker">
                  <input value={form.recordingPath} readOnly placeholder="~/Videos/NovaStream (par défaut)" />
                  <button type="button" onClick={pickRecordingFolder}>Parcourir</button>
                </div>
              </label>
              <p className="settings-hint">
                L'enregistrement capture la scène en vidéo seule par défaut — l'audio n'est pas requis.
                Cochez « Inclure l'audio » pour ajouter le micro. En stream, l'audio suit les réglages de l'onglet Audio.
              </p>
            </>
          )}
          {tab === 'Scènes' && (
            <>
              <p className="settings-hint">
                Collection active : <strong>{activeCollectionName}</strong>
                {collections.length > 1 && ` (${collections.length} collections)`}
              </p>

              <div className="settings-scenes-actions">
                <button type="button" className="settings-scenes-btn" onClick={onExportScenes}>
                  Exporter la collection active
                </button>
                <button type="button" className="settings-scenes-btn" onClick={onExportAllCollections}>
                  Exporter toutes les collections
                </button>
                <button type="button" className="settings-scenes-btn primary" onClick={onImportScenes}>
                  Importer des scènes / collections
                </button>
              </div>

              <hr className="settings-hr" />

              <label className="settings-field">
                Appliquer un modèle
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value as SceneTemplateId)}
                >
                  {SCENE_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                  ))}
                </select>
              </label>
              <p className="settings-hint">
                {SCENE_TEMPLATES.find((t) => t.id === selectedTemplate)?.description}
              </p>
              <div className="settings-scenes-actions">
                <button
                  type="button"
                  className="settings-scenes-btn"
                  onClick={() => onApplyTemplate?.(selectedTemplate, 'replace')}
                >
                  Remplacer la collection active
                </button>
                <button
                  type="button"
                  className="settings-scenes-btn"
                  onClick={() => onApplyTemplate?.(selectedTemplate, 'new')}
                >
                  Créer une nouvelle collection
                </button>
              </div>
              <p className="settings-hint warn">
                « Remplacer » écrase les scènes de la collection active. Utilisez l&apos;export avant si besoin.
              </p>
            </>
          )}

          {tab === 'Avancé' && (
            <>
              <p className="settings-hint">
                Nova Stream vérifie automatiquement les mises à jour au lancement (application installée uniquement).
              </p>
              <div className="settings-scenes-actions">
                <button
                  type="button"
                  className="settings-scenes-btn"
                  disabled={checkingUpdate}
                  onClick={async () => {
                    setCheckingUpdate(true)
                    setUpdateMessage(null)
                    try {
                      await window.novaStream.updates.check()
                    } finally {
                      setCheckingUpdate(false)
                    }
                  }}
                >
                  {checkingUpdate ? 'Vérification…' : 'Vérifier les mises à jour'}
                </button>
                <button
                  type="button"
                  className="settings-scenes-btn primary"
                  onClick={() => void window.novaStream.updates.install()}
                >
                  Redémarrer et installer la mise à jour
                </button>
              </div>
              {updateMessage && <p className="settings-hint">{updateMessage}</p>}

              <hr className="settings-hr" />

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
