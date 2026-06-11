import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

import NavRail from './components/NavRail'

import Header from './components/Header'

import Preview from './components/Preview'

import ChatPanel from './components/ChatPanel'

import EventsPanel from './components/EventsPanel'

import DockLayout from './components/DockLayout'

import ScenesDock from './components/ScenesDock'

import SourcesDock from './components/SourcesDock'

import MixerDock from './components/MixerDock'

import ControlsDock from './components/ControlsDock'

import StatusBar from './components/StatusBar'

import SettingsModal from './components/SettingsModal'

import IntegrationsPanel from './components/IntegrationsPanel'

import PreviewHeightResizer from './components/PreviewHeightResizer'

import { useScenes } from './hooks/useScenes'

import { useIntegrations } from './hooks/useIntegrations'

import { useSceneMedia } from './hooks/useSceneMedia'

import { useSceneCapture } from './hooks/useSceneCapture'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useSceneTransition } from './hooks/useSceneTransition'

import type { AppView, MediaState, StreamSettings } from './types'

import { DEFAULT_STREAM_SETTINGS } from './types'
import { migrateStreamSettings } from './lib/audioGain'

import './styles/app.css'



const DEFAULT_MEDIA_STATE: MediaState = {

  stream: { status: 'idle' },

  recording: { status: 'idle' }

}



function App() {

  const scenes = useScenes()

  const integrations = useIntegrations()

  const { streamsRef } = useSceneMedia(scenes.activeScene?.sources ?? [])

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneCapture = useSceneCapture(streamsRef, previewCanvasRef)

  const [view, setView] = useState<AppView>('editor')

  const [mediaState, setMediaState] = useState<MediaState>(DEFAULT_MEDIA_STATE)

  const [settings, setSettings] = useState<StreamSettings>(() => {

    try {

      const saved = localStorage.getItem('nova-stream-settings')

      return saved
        ? { ...DEFAULT_STREAM_SETTINGS, ...migrateStreamSettings(JSON.parse(saved)) }
        : DEFAULT_STREAM_SETTINGS

    } catch {

      return DEFAULT_STREAM_SETTINGS

    }

  })

  const [showSettings, setShowSettings] = useState(false)

  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('nova-welcome-seen'))

  const [websiteUrl, setWebsiteUrl] = useState('https://hazeyy5.github.io/nova-stream')
  const [previewFps, setPreviewFps] = useState(0)

  const PREVIEW_HEIGHT_KEY = 'nova-preview-height'
  const PREVIEW_HEIGHT_DEFAULT = 280
  const PREVIEW_HEIGHT_MIN = 120
  const PREVIEW_HEIGHT_MAX_RATIO = 0.72

  const [previewHeight, setPreviewHeight] = useState(() => {
    try {
      const saved = localStorage.getItem(PREVIEW_HEIGHT_KEY)
      const n = saved ? Number(saved) : PREVIEW_HEIGHT_DEFAULT
      return Number.isFinite(n) && n >= PREVIEW_HEIGHT_MIN ? n : PREVIEW_HEIGHT_DEFAULT
    } catch {
      return PREVIEW_HEIGHT_DEFAULT
    }
  })

  const handlePreviewResize = useCallback((deltaY: number) => {
    setPreviewHeight((h) => {
      const max = Math.floor(window.innerHeight * PREVIEW_HEIGHT_MAX_RATIO)
      return Math.max(PREVIEW_HEIGHT_MIN, Math.min(max, h + deltaY))
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(PREVIEW_HEIGHT_KEY, String(previewHeight))
  }, [previewHeight])



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

    for (const source of scenes.activeScene?.sources ?? []) {

      window.novaStream.sourceProps.sync(source)

    }

  }, [scenes.activeScene?.sources])



  useEffect(() => {

    window.novaStream.audioProps.sync('mic', settings)

    window.novaStream.audioProps.sync('desktop', settings)

  }, [settings])



  useEffect(() => {

    const unsub = window.novaStream.audioProps.onApplyPatch((partial) => {

      setSettings((s) => ({ ...s, ...partial }))

    })

    return unsub

  }, [])



  useEffect(() => {

    window.novaStream.devices.listMedia().then((devices) => {

      const mics = devices.filter(
        (d) => d.type === 'audio' && d.audioRole === 'input'
      )
      const desktop = devices.filter(
        (d) => d.type === 'audio' && (d.audioRole === 'output' || d.audioRole === 'loopback')
      )

      setSettings((s) => ({

        ...s,

        audioDevice: s.audioDevice || mics.find((d) => d.isDefault)?.name || mics[0]?.name || '',

        desktopAudioDevice: s.desktopAudioDevice
          && desktop.some((d) => d.name === s.desktopAudioDevice)
          ? s.desktopAudioDevice
          : desktop.find((d) => d.isDefault && d.audioRole === 'output')?.name
          || desktop.find((d) => d.audioRole === 'output')?.name
          || desktop.find((d) => d.audioRole === 'loopback')?.name
          || ''

      }))

    })

  }, [])



  const startMedia = useCallback(async (stream: boolean, record: boolean) => {

    if (!scenes.activeScene) return

    try {

      await sceneCapture.arm()

      const videoInputFormat = await sceneCapture.beginPipe(settings.videoBitrate, settings.framerate)

      const result = await window.novaStream.media.start({
        settings,
        stream,
        record,
        videoInputFormat
      })

      if (!result.success) {

        await sceneCapture.disarm()

        alert(result.message ?? 'Erreur au démarrage')

        return

      }

    } catch (err) {

      await sceneCapture.disarm()

      await window.novaStream.media.stop()

      alert(err instanceof Error ? err.message : 'Erreur au démarrage')

    }

  }, [settings, scenes.activeScene, sceneCapture])



  const stopAll = useCallback(async () => {

    await sceneCapture.disarm()

    await window.novaStream.media.stop()

  }, [sceneCapture])



  const streamKeyFetchRef = useRef(false)
  const twitchConnected = integrations.connections.some((c) => c.platform === 'twitch')

  const tryAutoFetchStreamKey = useCallback(async () => {
    if (!twitchConnected) return
    if (settings.streamKey.trim()) return
    if (streamKeyFetchRef.current) return

    streamKeyFetchRef.current = true
    try {
      const key = await integrations.fetchTwitchStreamKey()
      if (key) {
        setSettings((s) => ({
          ...s,
          streamKey: key,
          rtmpUrl: s.rtmpUrl.trim() || 'rtmp://live.twitch.tv/app'
        }))
      }
    } catch {
      /* récupérable manuellement dans Paramètres */
    } finally {
      streamKeyFetchRef.current = false
    }
  }, [twitchConnected, settings.streamKey, integrations.fetchTwitchStreamKey])

  useEffect(() => {
    void tryAutoFetchStreamKey()
  }, [twitchConnected, tryAutoFetchStreamKey])

  const handleConnectTwitch = async () => {
    try {
      await integrations.connectTwitch()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Connexion échouée')
    }
  }



  const isLive = mediaState.stream.status === 'live'
  const isRecording = mediaState.recording.status === 'recording'
  const isMediaActive = isLive || isRecording || mediaState.stream.status === 'starting'

  const handleFps = useCallback((fps: number) => setPreviewFps(fps), [])

  const { switchScene, fadeOpacity } = useSceneTransition(
    settings.transition,
    settings.transitionDuration,
    scenes.setActiveSceneId
  )

  const handleSceneSelect = useCallback(
    (sceneId: string) => switchScene(sceneId, scenes.activeSceneId),
    [switchScene, scenes.activeSceneId]
  )

  const handleImportScenes = useCallback(async () => {
    try {
      const json = await window.novaStream.dialog.importScenesFile()
      if (json) scenes.importScenesFromJson(json)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import échoué')
    }
  }, [scenes])

  const canStream = settings.streamKey.trim().length > 0

  const shortcutHandlers = useMemo(() => ({
    onSceneHotkey: (index: number) => {
      const scene = scenes.scenes[index]
      if (scene) handleSceneSelect(scene.id)
    },
    onToggleRecord: () => {
      if (isMediaActive) stopAll()
      else startMedia(false, true)
    },
    onToggleStream: () => {
      if (!canStream) return
      if (isLive) stopAll()
      else if (!isMediaActive) startMedia(true, settings.recordingEnabled)
    },
    onDeleteSource: () => {
      if (scenes.selectedSourceId) scenes.removeSource(scenes.selectedSourceId)
    },
    onDuplicateSource: () => {
      if (scenes.selectedSourceId) scenes.duplicateSource(scenes.selectedSourceId)
    }
  }), [scenes, isMediaActive, stopAll, startMedia, handleSceneSelect, canStream, isLive, settings.recordingEnabled])

  useKeyboardShortcuts(shortcutHandlers, view === 'editor')



  return (

    <div className="app">

      <NavRail

        activeView={view}

        onViewChange={setView}

        onSettingsClick={() => setShowSettings(true)}

        hasConnection={integrations.connections.length > 0}

        bitrate={settings.videoBitrate}

        onAddWidget={() => {

          setView('editor')

          scenes.addSource('chat')

        }}

        onAddAlert={() => {

          setView('editor')

          scenes.addSource('alert')

        }}

      />



      <div className="workspace">

        {view === 'editor' ? (

          <div className="editor-layout">

            <Header

              sceneName={scenes.activeScene?.name ?? 'Scène'}

              isLive={isLive}

              isRecording={isRecording}

            />



            <div className="editor-main">

              <div className="editor-center">

                <div className="preview-zone" style={{ height: previewHeight }}>

                  <Preview

                    sources={scenes.activeScene?.sources ?? []}

                    selectedSourceId={scenes.selectedSourceId}

                    onSelectSource={scenes.setSelectedSourceId}

                    onUpdateSource={scenes.updateSource}

                    chatMessages={integrations.messages}

                    activeAlerts={integrations.activeAlerts}
                    widgetLiveData={integrations.widgetLiveData}

                    streamsRef={streamsRef}
                    canvasRef={previewCanvasRef}
                    resolution={settings.resolution}
                    targetFps={settings.framerate}
                    onFps={handleFps}
                    onFrameDrawn={sceneCapture.onFrameDrawn}
                    fadeOpacity={fadeOpacity}
                    captureActive={isMediaActive}
                  />

                </div>

                <PreviewHeightResizer onResize={handlePreviewResize} />

                <div className="dock-section">

                <DockLayout

                  scenes={

                    <ScenesDock

                      scenes={scenes.scenes}

                      activeSceneId={scenes.activeSceneId}

                      onSceneSelect={handleSceneSelect}

                      onAddScene={scenes.addScene}

                      onRemoveScene={scenes.removeScene}

                      onRenameScene={scenes.renameScene}

                      onDuplicateScene={scenes.duplicateScene}

                      onMoveScene={scenes.moveScene}

                      onExportScenes={scenes.exportScenes}

                      onImportScenes={handleImportScenes}

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
                      onDuplicateSource={scenes.duplicateSource}
                    />

                  }

                  mixer={

                    <MixerDock
                      settings={settings}
                      onUpdateSettings={(partial) => setSettings((s) => ({ ...s, ...partial }))}
                      onOpenSettings={() => setShowSettings(true)}
                    />

                  }

                  controls={

                    <ControlsDock

                      mediaState={mediaState}

                      settings={settings}

                      onGoLive={() => startMedia(true, settings.recordingEnabled)}

                      onStartRecord={() => startMedia(false, true)}

                      onStopAll={stopAll}

                      onOpenSettings={() => setShowSettings(true)}

                      onTestAlert={() => integrations.testAlert('follow')}

                    />

                  }

                />

                </div>

              </div>



              <aside className="right-sidebar">

                <ChatPanel
                  messages={integrations.messages}
                  canSend={integrations.chatStatus.canSend}
                  chatHint={
                    integrations.chatStatus.linked && !integrations.chatStatus.chatConnected
                      ? 'Compte Twitch lié mais chat déconnecté — reconnectez dans Apps.'
                      : undefined
                  }
                  onSend={integrations.sendChatMessage}
                />

                <EventsPanel events={integrations.feedEvents} onClear={integrations.clearFeed} />

              </aside>

            </div>



            <StatusBar settings={settings} fps={previewFps} />

          </div>

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

          twitchConnected={integrations.isConnected('twitch')}

          onFetchTwitchStreamKey={integrations.fetchTwitchStreamKey}

        />

      )}

    </div>

  )

}



export default App

