import { readFileSync, writeFileSync } from 'fs'
import { extname, join } from 'path'
import { app, BrowserWindow, ipcMain, desktopCapturer, session, dialog, shell } from 'electron'
import { getAppIcon } from './appIcon'
import { loadEnv } from './loadEnv'
import { StreamManager } from './streamManager'
import { listMediaDevices, setMediaListWindow } from './deviceManager'
import { IntegrationManager } from './integrations/integrationManager'
import { LinkServer } from './integrations/linkServer'
import { getPlatformConfig } from './platformConfig'
import { runSpeedtest } from './speedtest'
import { scanEncoderRecommendation } from './encoderProbe'
import {
  setMainWindow,
  openSourcePropertiesWindow,
  syncSourcePropertiesWindow,
  closeSourcePropertiesWindow,
  forwardPatch,
  forwardRecapture
} from './sourcePropertiesWindow'
import {
  setAudioPropsMainWindow,
  openAudioPropertiesWindow,
  syncAudioPropertiesWindow,
  closeAudioPropertiesWindow,
  forwardAudioSettingsPatch
} from './audioPropertiesWindow'
import {
  setCapturePickerMainWindow,
  openCapturePickerWindow,
  closeCapturePickerWindow,
  forwardCaptureSelect
} from './capturePickerWindow'
import { desktopAudioMeterService } from './audioMeterService'
import { streamAudioMeterService } from './streamMeterParser'
import { initAutoUpdater, checkForUpdatesManual, installUpdateNow, getUpdateState, syncUpdateStateToRenderer, scheduleStartupUpdateCheck } from './autoUpdater'
import type { AlertType, AudioChannelId, Source, StreamSettings } from '../../src/types'

const GAME_CAPTURE_EXCLUDED = [
  'program manager',
  'nova stream',
  'electron',
  'barre des tâches',
  'taskbar',
  'paramètres',
  'settings',
  'explorateur de fichiers',
  'file explorer',
  'windows shell experience',
  'input experience',
  'nouvel onglet',
  'new tab',
  'cursor',
  'visual studio code',
  'obs studio',
  'streamlabs'
]

function isGameCaptureWindow(name: string): boolean {
  const normalized = name.toLowerCase().trim()
  if (normalized.length < 2) return false
  return !GAME_CAPTURE_EXCLUDED.some((excluded) => normalized.includes(excluded))
}

loadEnv()

const streamManager = new StreamManager()
const integrations = new IntegrationManager()
const linkServer = new LinkServer(integrations)
let appMainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const appIcon = getAppIcon()
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 580,
    show: false,
    title: 'Nova Stream',
    icon: appIcon,
    backgroundColor: '#161625',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      backgroundThrottling: false
    }
  })

  mainWindow.setMenuBarVisibility(false)
  mainWindow.center()
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    syncUpdateStateToRenderer()
    scheduleStartupUpdateCheck()
  })

  setMainWindow(mainWindow)
  setAudioPropsMainWindow(mainWindow)
  setCapturePickerMainWindow(mainWindow)
  setMediaListWindow(mainWindow)
  appMainWindow = mainWindow
  return mainWindow
}

app.whenReady().then(async () => {
  session.fromPartition('persist:nova-browser-sources').setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(true)
  })

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      const screen = sources.find((s) => s.id.startsWith('screen:'))
      callback({ video: screen ?? sources[0], audio: 'loopback' })
    })
  })

  streamManager.setOnStateChange((state) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('media:status', state)
    }
  })

  linkServer.start()
  ipcMain.handle('link:getPort', () => linkServer.getPort())
  ipcMain.handle('platform:getConfig', () => ({
    ...getPlatformConfig(),
    version: app.getVersion()
  }))
  ipcMain.handle('platform:openExternal', async (_e, url: unknown) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { success: false, message: 'URL invalide' }
    }
    await shell.openExternal(url)
    return { success: true }
  })

  ipcMain.on('media:video-chunk', (_event, payload: Uint8Array | { chunk: Uint8Array; durationMs?: number }) => {
    if (payload instanceof Uint8Array || Buffer.isBuffer(payload)) {
      streamManager.handleVideoChunk(Buffer.from(payload))
      return
    }
    const durationMs = typeof payload.durationMs === 'number' ? payload.durationMs : undefined
    streamManager.handleVideoChunk(Buffer.from(payload.chunk), durationMs)
  })

  ipcMain.handle('media:start', async (_event, payload: {
    settings: StreamSettings
    stream: boolean
    record: boolean
    videoInputFormat?: 'h264' | 'webm'
  }) => {
    try {
      await streamManager.start(payload)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      return { success: false, message }
    }
  })

  ipcMain.handle('media:stop', async () => {
    await streamManager.stop()
    return { success: true }
  })

  ipcMain.handle('media:getStatus', () => streamManager.getState())
  ipcMain.handle('media:isActive', () => streamManager.isActive())
  ipcMain.handle('media:getHealth', () => streamManager.getHealth())

  ipcMain.handle('media:updateAudioSettings', (_event, settings: StreamSettings) => {
    streamManager.updateAudioSettings(settings)
    return { success: true }
  })

  ipcMain.handle('media:updateMixerSettings', (_event, settings: StreamSettings) => {
    streamManager.updateMixerSettings(settings)
    return { success: true }
  })

  ipcMain.handle('devices:getDisplays', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 320, height: 180 }
    })
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      displayId: s.display_id,
      thumbnail: s.thumbnail.toDataURL()
    }))
  })

  ipcMain.handle('devices:getCaptureSources', async (_e, kind: 'screen' | 'window' | 'game' | 'all') => {
    const types = kind === 'all' ? (['screen', 'window'] as const) : kind === 'game' ? (['window'] as const) : [kind]
    const sources = await desktopCapturer.getSources({
      types: [...types],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true
    })
    const filtered = kind === 'game'
      ? sources.filter((s) => isGameCaptureWindow(s.name))
      : sources
    return filtered.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.id.startsWith('screen:') ? 'screen' as const : 'window' as const,
      thumbnail: s.thumbnail.toDataURL()
    }))
  })

  ipcMain.handle('devices:listMedia', () => listMediaDevices(appMainWindow))

  ipcMain.handle('system:scanEncoders', async () => {
    try {
      const recommendation = await scanEncoderRecommendation()
      return { success: true, recommendation }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Analyse matérielle impossible'
      }
    }
  })

  ipcMain.handle('dialog:selectRecordingFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Dossier d\'enregistrement'
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:saveImage', async (_e, dataUrl: string) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const result = await dialog.showSaveDialog({
      title: 'Enregistrer la capture',
      defaultPath: `nova-capture-${stamp}.png`,
      filters: [{ name: 'Image PNG', extensions: ['png'] }]
    })
    if (result.canceled || !result.filePath) return null
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    writeFileSync(result.filePath, Buffer.from(base64, 'base64'))
    return result.filePath
  })

  ipcMain.handle('dialog:importScenesFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Importer des scènes',
      filters: [{ name: 'Nova Stream Scènes', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return readFileSync(result.filePaths[0], 'utf-8')
  })

  ipcMain.handle('dialog:selectImageFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choisir une image',
      filters: [{
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']
      }],
      properties: ['openFile']
    })
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:readImageFile', (_e, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') return null
    try {
      const ext = extname(filePath).slice(1).toLowerCase()
      const mime: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        bmp: 'image/bmp',
        svg: 'image/svg+xml'
      }
      const buf = readFileSync(filePath)
      return `data:${mime[ext] ?? 'image/png'};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('speedtest:run', async (event, payload: {
    resolution: string
    framerate: number
    audioBitrate: number
  }) => {
    return runSpeedtest(
      payload.resolution,
      payload.framerate,
      payload.audioBitrate,
      (percent) => event.sender.send('speedtest:progress', percent)
    )
  })

  ipcMain.handle('integrations:getConnections', () => integrations.getConnections())
  ipcMain.handle('integrations:isTwitchConfigured', () => integrations.isTwitchConfigured())

  ipcMain.handle('integrations:connectTwitch', async () => {
    try {
      const conn = await integrations.connectTwitch()
      return { success: true, connection: conn }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Erreur' }
    }
  })

  ipcMain.handle('integrations:disconnect', async (_e, platform: 'twitch' | 'kick') => {
    await integrations.disconnect(platform)
    return { success: true }
  })

  ipcMain.handle('integrations:getMessages', () => integrations.getMessages())
  ipcMain.handle('integrations:getFeed', () => integrations.getFeedEvents())
  ipcMain.handle('integrations:clearFeed', () => {
    integrations.clearFeedEvents()
    return { success: true }
  })
  ipcMain.handle('integrations:getAlerts', () => integrations.getActiveAlerts())
  ipcMain.handle('integrations:getWidgetLiveData', () => integrations.getWidgetLiveData())
  ipcMain.handle('integrations:testAlert', (_e, type?: AlertType) => {
    integrations.testAlert(type)
  })

  ipcMain.handle('integrations:getChatStatus', () => integrations.getChatStatus())

  ipcMain.handle('integrations:sendChatMessage', async (_e, text: string) => {
    return integrations.sendChatMessage(text)
  })

  ipcMain.handle('integrations:fetchTwitchStreamKey', async () => {
    try {
      const streamKey = await integrations.getTwitchStreamKey()
      return { success: true, streamKey }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Erreur'
      }
    }
  })

  ipcMain.handle('integrations:getTwitchChannelInfo', async () => {
    try {
      const info = await integrations.getTwitchChannelInfo()
      return { success: true, info }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Erreur'
      }
    }
  })

  ipcMain.handle('integrations:searchTwitchCategories', async (_e, query: string) => {
    try {
      const categories = await integrations.searchTwitchCategories(query)
      return { success: true, categories }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Erreur'
      }
    }
  })

  ipcMain.handle('integrations:fetchTopTwitchCategories', async (_e, limit?: number) => {
    try {
      const categories = await integrations.fetchTopTwitchCategories(limit)
      return { success: true, categories }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Erreur'
      }
    }
  })

  ipcMain.handle('integrations:updateTwitchChannelInfo', async (_e, payload: {
    title: string
    categoryId: string
  }) => {
    try {
      await integrations.updateTwitchChannelInfo(payload.title, payload.categoryId)
      return { success: true }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Erreur'
      }
    }
  })

  ipcMain.handle('sourceProps:open', (_e, source: Source) => {
    openSourcePropertiesWindow(source)
  })

  ipcMain.handle('sourceProps:sync', (_e, source: Source) => {
    syncSourcePropertiesWindow(source)
  })

  ipcMain.handle('sourceProps:close', (_e, sourceId: string) => {
    closeSourcePropertiesWindow(sourceId)
  })

  ipcMain.on('sourceProps:ready', (event) => {
    // Fenêtre propriétés prête — rien à faire, init envoyé au did-finish-load
    void event
  })

  ipcMain.on('sourceProps:patch', (_e, payload: { sourceId: string; partial: Partial<Source> }) => {
    forwardPatch(payload.sourceId, payload.partial)
  })

  ipcMain.on('sourceProps:recapture', (_e, payload: { sourceId: string; kind: 'screen' | 'window' | 'game' }) => {
    forwardRecapture(payload.sourceId, payload.kind)
  })

  ipcMain.handle('capturePicker:open', (_e, payload: import('../../src/types').CapturePickerOpenPayload) => {
    openCapturePickerWindow(payload)
  })

  ipcMain.on('capturePicker:ready', (event) => {
    void event
  })

  ipcMain.on('capturePicker:select', (_e, payload: Parameters<typeof forwardCaptureSelect>[0]) => {
    forwardCaptureSelect(payload)
  })

  ipcMain.on('capturePicker:cancel', () => {
    closeCapturePickerWindow()
  })

  ipcMain.handle('audioProps:open', (_e, payload: { channel: AudioChannelId; settings: StreamSettings }) => {
    openAudioPropertiesWindow(payload.channel, payload.settings)
  })

  ipcMain.handle('audioProps:sync', (_e, payload: { channel: AudioChannelId; settings: StreamSettings }) => {
    syncAudioPropertiesWindow(payload.channel, payload.settings)
  })

  ipcMain.handle('audioProps:close', (_e, channel: AudioChannelId) => {
    closeAudioPropertiesWindow(channel)
  })

  ipcMain.on('audioProps:ready', (event) => {
    void event
  })

  ipcMain.on('audioProps:patch', (_e, partial: Partial<StreamSettings>) => {
    forwardAudioSettingsPatch(partial)
  })

  ipcMain.handle('audioMeter:subscribeDesktop', (event) => {
    desktopAudioMeterService.subscribe(event.sender)
  })

  ipcMain.handle('audioMeter:unsubscribeDesktop', (event) => {
    desktopAudioMeterService.unsubscribe(event.sender)
  })

  ipcMain.handle('audioMeter:subscribeStream', (event) => {
    streamAudioMeterService.subscribe(event.sender)
  })

  ipcMain.handle('audioMeter:unsubscribeStream', (event) => {
    streamAudioMeterService.unsubscribe(event.sender)
  })

  ipcMain.handle('updates:getState', () => getUpdateState())
  ipcMain.handle('updates:check', () => checkForUpdatesManual())
  ipcMain.handle('updates:install', () => {
    installUpdateNow()
    return { success: true }
  })

  createWindow()

  initAutoUpdater()

  void integrations.restoreSessions()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
