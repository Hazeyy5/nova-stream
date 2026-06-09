import { useState, useEffect, useCallback, useMemo } from 'react'

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

import WelcomeModal from './components/WelcomeModal'

import { useScenes } from './hooks/useScenes'

import { useIntegrations } from './hooks/useIntegrations'

import { useSceneMedia } from './hooks/useSceneMedia'

import { useSceneCapture } from './hooks/useSceneCapture'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

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

  const { streamsRef } = useSceneMedia(scenes.activeScene?.sources ?? [])

  const sceneCapture = useSceneCapture(streamsRef)

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
  const [previewFps, setPreviewFps] = useState(0)



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

        desktopAudioDevice: s.desktopAudioDevice || devices.find((d) => d.type === 'audio')?.name || ''

      }))

    })

  }, [])



  const isCapturing =

    mediaState.recording.status === 'recording' ||

    mediaState.stream.status === 'live' ||

    mediaState.stream.status === 'starting'



  useEffect(() => {

    if (!isCapturing || !scenes.activeScene) return

    sceneCapture.updateLiveState({

      sources: scenes.activeScene.sources,

      settings,

      chatMessages: integrations.messages,

      activeAlerts: integrations.activeAlerts

    })

  }, [

    isCapturing,

    scenes.activeScene,

    scenes.activeSceneId,

    settings,

    integrations.messages,

    integrations.activeAlerts,

    sceneCapture

  ])



  const startMedia = useCallback(async (stream: boolean, record: boolean) => {

    if (!scenes.activeScene) return

    const liveState = {

      sources: scenes.activeScene.sources,

      settings,

      chatMessages: integrations.messages,

      activeAlerts: integrations.activeAlerts

    }

    try {

      await sceneCapture.arm(liveState)

      sceneCapture.beginPipe(settings.videoBitrate)

      const result = await window.novaStream.media.start({ settings, stream, record })

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

  }, [settings, scenes.activeScene, integrations.messages, integrations.activeAlerts, sceneCapture])



  const stopAll = useCallback(async () => {

    await sceneCapture.disarm()

    await window.novaStream.media.stop()

  }, [sceneCapture])



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

  const shortcutHandlers = useMemo(() => ({
    onSceneHotkey: (index: number) => {
      const scene = scenes.scenes[index]
      if (scene) scenes.setActiveSceneId(scene.id)
    },
    onToggleRecord: () => {
      if (isMediaActive) stopAll()
      else startMedia(false, true)
    },
    onDeleteSource: () => {
      if (scenes.selectedSourceId) scenes.removeSource(scenes.selectedSourceId)
    },
    onDuplicateSource: () => {
      if (scenes.selectedSourceId) scenes.duplicateSource(scenes.selectedSourceId)
    }
  }), [scenes, isMediaActive, stopAll, startMedia])

  useKeyboardShortcuts(shortcutHandlers, view === 'editor')



  return (

    <div className="app">

      <NavRail

        activeView={view}

        onViewChange={setView}

        onSettingsClick={() => setShowSettings(true)}

        hasConnection={integrations.connections.length > 0}

        bitrate={settings.videoBitrate}

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

                <div className="preview-zone">

                  <Preview

                    sources={scenes.activeScene?.sources ?? []}

                    selectedSourceId={scenes.selectedSourceId}

                    onSelectSource={scenes.setSelectedSourceId}

                    onUpdateSource={scenes.updateSource}

                    chatMessages={integrations.messages}

                    activeAlerts={integrations.activeAlerts}

                    streamsRef={streamsRef}
                    targetFps={Math.min(settings.framerate, 30)}
                    onFps={handleFps}
                  />

                </div>



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



              <aside className="right-sidebar">

                <ChatPanel messages={integrations.messages} />

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

        />

      )}

    </div>

  )

}



export default App

