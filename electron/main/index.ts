import { app, BrowserWindow, ipcMain, desktopCapturer, session, dialog } from 'electron'
import { join } from 'path'
import { loadEnv } from './loadEnv'
import { StreamManager } from './streamManager'
import { listMediaDevices } from './deviceManager'
import { IntegrationManager } from './integrations/integrationManager'
import { LinkServer } from './integrations/linkServer'
import { getPlatformConfig } from './platformConfig'
import type { AlertType, SceneStreamConfig, StreamSettings } from '../../src/types'

loadEnv()

const streamManager = new StreamManager()
const integrations = new IntegrationManager()
const linkServer = new LinkServer(integrations)

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    title: 'Nova Stream',
    backgroundColor: '#0a0c14',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setMenuBarVisibility(false)

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
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

  ipcMain.handle('media:start', async (_event, payload: {
    settings: StreamSettings
    scene: SceneStreamConfig
    stream: boolean
    record: boolean
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

  ipcMain.handle('devices:listMedia', () => listMediaDevices())

  ipcMain.handle('dialog:selectRecordingFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Dossier d\'enregistrement'
    })
    return result.canceled ? null : result.filePaths[0]
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
  ipcMain.handle('integrations:getAlerts', () => integrations.getActiveAlerts())
  ipcMain.handle('integrations:testAlert', (_e, type?: AlertType) => {
    integrations.testAlert(type)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
