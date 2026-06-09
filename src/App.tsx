import { useState, useEffect, useCallback } from 'react'
import NavRail from './components/NavRail'
import Preview from './components/Preview'
import ActivityFeed from './components/ActivityFeed'
import DockLayout from './components/DockLayout'
import ScenesDock from './components/ScenesDock'
import SourcesDock from './components/SourcesDock'
import MixerDock from './components/MixerDock'
import ActionBar from './components/ActionBar'
import SettingsModal from './components/SettingsModal'
import IntegrationsPanel from './components/IntegrationsPanel'
import WelcomeModal from './components/WelcomeModal'
import { useScenes } from './hooks/useScenes'
import { useIntegrations } from './hooks/useIntegrations'
import type { AppView, MediaState, StreamSettings } from './types'
import { DEFAULT_STREAM_SETTINGS } from './types'
import './styles/app.css'

const DEFAULT_MEDIA_STATE: MediaState = {
  stream: { status: 'idle' },
  recording: { status: 'idle' }
}

function App() {
  const scenes = useScenes()
  const integrations = useIntegrations()
  const [view, setView] = useState<AppView>('editor')
  const [mediaState, setMediaState] = useState<MediaState>(DEFAULT_MEDIA_STATE)
  const [settings, setSettings] = useState<StreamSettings>(() => {
    try {
      const saved = localStorage.getItem('nova-stream-settings')
      return saved ? { ...DEFAULT_STREAM_SETTINGS, ...JSON.parse(saved) } : DEFAULT_STREAM_SETTINGS
    } catch {
      return DEFAULT_STREAM_SETTINGS
    }
  })
  const [showSettings, setShowSettings] = useState(false)
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('nova-welcome-seen'))
  const [websiteUrl, setWebsiteUrl] = useState('https://hazeyy5.github.io/nova-stream')

  useEffect(() => {
    localStorage.setItem('nova-stream-settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    window.novaStream.media.getStatus().then(setMediaState)
    return window.novaStream.media.onStatusChange(setMediaState)
  }, [])

  useEffect(() => {
    window.novaStream.platform.getConfig().then((c) => setWebsiteUrl(c.websiteUrl))
  }, [])

  useEffect(() => {
    window.novaStream.devices.listMedia().then((devices) => {
      setSettings((s) => ({
        ...s,
        audioDevice: s.audioDevice || devices.find((d) => d.type === 'audio')?.name || '',
        webcamDevice: s.webcamDevice || devices.find((d) => d.type === 'video')?.name || '',
        desktopAudioDevice: s.desktopAudioDevice || devices.find((d) => d.type === 'audio')?.name || ''
      }))
    })
  }, [])

  const startMedia = useCallback(async (stream: boolean, record: boolean) => {
    if (!scenes.activeScene) return
    const result = await window.novaStream.media.start({
      settings,
      scene: { sources: scenes.activeScene.sources, resolution: settings.resolution },
      stream,
      record
    })
    if (!result.success) alert(result.message ?? 'Erreur au démarrage')
  }, [settings, scenes.activeScene])

  const stopAll = useCallback(async () => {
    await window.novaStream.media.stop()
  }, [])

  const handleConnectTwitch = async () => {
    try {
      await integrations.connectTwitch()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Connexion échouée')
    }
  }

  return (
    <div className="app">
      <NavRail
        activeView={view}
        onViewChange={setView}
        onSettingsClick={() => setShowSettings(true)}
        hasConnection={integrations.connections.length > 0}
      />

      <div className="workspace">
        {view === 'editor' ? (
          <>
            <div className="preview-zone">
              <Preview
                sources={scenes.activeScene?.sources ?? []}
                selectedSourceId={scenes.selectedSourceId}
                onSelectSource={scenes.setSelectedSourceId}
                onUpdateSource={scenes.updateSource}
                chatMessages={integrations.messages}
                activeAlerts={integrations.activeAlerts}
              />
            </div>

            <ActivityFeed events={integrations.feedEvents} />

            <DockLayout
              scenes={
                <ScenesDock
                  scenes={scenes.scenes}
                  activeSceneId={scenes.activeSceneId}
                  onSceneSelect={scenes.setActiveSceneId}
                  onAddScene={scenes.addScene}
                  onRemoveScene={scenes.removeScene}
                  onRenameScene={scenes.renameScene}
                />
              }
              sources={
                <SourcesDock
                  sources={scenes.activeScene?.sources ?? []}
                  selectedSourceId={scenes.selectedSourceId}
                  selectedSource={scenes.selectedSource}
                  onSourceSelect={scenes.setSelectedSourceId}
                  onAddSource={scenes.addSource}
                  onUpdateSource={scenes.updateSource}
                  onRemoveSource={scenes.removeSource}
                  onMoveSource={scenes.moveSource}
                />
              }
              mixer={
                <MixerDock
                  settings={settings}
                  onUpdateSettings={(partial) => setSettings((s) => ({ ...s, ...partial }))}
                />
              }
            />

            <ActionBar
              mediaState={mediaState}
              settings={settings}
              onGoLive={() => startMedia(true, settings.recordingEnabled)}
              onStartRecord={() => startMedia(false, true)}
              onStopAll={stopAll}
              onOpenSettings={() => setShowSettings(true)}
              onTestAlert={() => integrations.testAlert('follow')}
            />
          </>
        ) : (
          <IntegrationsPanel
            connections={integrations.connections}
            twitchConfigured={integrations.twitchConfigured}
            connecting={integrations.connecting}
            onConnectTwitch={handleConnectTwitch}
            onDisconnect={integrations.disconnect}
            onTestAlert={() => integrations.testAlert('sub')}
          />
        )}
      </div>

      {showWelcome && (
        <WelcomeModal
          websiteUrl={websiteUrl}
          onClose={() => {
            localStorage.setItem('nova-welcome-seen', '1')
            setShowWelcome(false)
          }}
          onOpenIntegrations={() => {
            localStorage.setItem('nova-welcome-seen', '1')
            setShowWelcome(false)
            setView('integrations')
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={(s) => { setSettings(s); setShowSettings(false) }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

export default App
