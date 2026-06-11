import { readFileSync, writeFileSync } from 'fs'
import { extname, join } from 'path'
import { app, BrowserWindow, ipcMain, desktopCapturer, session, dialog, shell } from 'electron'
import { loadEnv } from './loadEnv'
import { StreamManager } from './streamManager'
import { listMediaDevices, setMediaListWindow } from './deviceManager'
import { IntegrationManager } from './integrations/integrationManager'
import { LinkServer } from './integrations/linkServer'
import { getPlatformConfig } from './platformConfig'
import { runSpeedtest } from './speedtest'
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
import { desktopAudioMeterService } from './audioMeterService'
import type { AlertType, AudioChannelId, Source, StreamSettings } from '../../src/types'

loadEnv()

const streamManager = new StreamManager()
const integrations = new IntegrationManager()
const linkServer = new LinkServer(integrations)
let appMainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    title: 'Nova Stream',
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

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  setMainWindow(mainWindow)
  setAudioPropsMainWindow(mainWindow)
  setMediaListWindow(mainWindow)
  appMainWindow = mainWindow
  return mainWindow
}

app.whenReady().then(async () => {
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
  await integrations.restoreSessions()

  ipcMain.handle('link:getPort', () => linkServer.getPort())
  ipcMain.handle('platform:getConfig', () => getPlatformConfig())
  ipcMain.handle('platform:openExternal', async (_e, url: unknown) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { success: false, message: 'URL invalide' }
    }
    await shell.openExternal(url)
    return { success: true }
  })

  ipcMain.on('media:video-chunk', (_event, chunk: Uint8Array) => {
    streamManager.handleVideoChunk(Buffer.from(chunk))
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

  ipcMain.handle('devices:getCaptureSources', async (_e, kind: 'screen' | 'window' | 'all') => {
    const types = kind === 'all' ? (['screen', 'window'] as const) : [kind]
    const sources = await desktopCapturer.getSources({
      types: [...types],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true
    })
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.id.startsWith('screen:') ? 'screen' as const : 'window' as const,
      thumbnail: s.thumbnail.toDataURL()
    }))
  })

  ipcMain.handle('devices:listMedia', () => listMediaDevices(appMainWindow))

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

  ipcMain.on('sourceProps:recapture', (_e, payload: { sourceId: string; kind: 'screen' | 'window' }) => {
    forwardRecapture(payload.sourceId, payload.kind)
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

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
