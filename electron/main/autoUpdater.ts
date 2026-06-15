import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface AppUpdateState {
  status: AppUpdateStatus
  version?: string
  progress?: number
  message?: string
}

let initialized = false

function broadcast(state: AppUpdateState): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('updates:state', state)
  }
}

export function getUpdateState(): AppUpdateState {
  return { status: 'idle' }
}

export function initAutoUpdater(): void {
  if (initialized || !app.isPackaged) return
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    broadcast({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    broadcast({
      status: 'available',
      version: info.version,
      message: `Mise à jour ${info.version} disponible — téléchargement…`
    })
  })

  autoUpdater.on('update-not-available', () => {
    broadcast({ status: 'not-available', message: 'Vous utilisez la dernière version.' })
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcast({
      status: 'downloading',
      progress: Math.round(progress.percent),
      message: `Téléchargement… ${Math.round(progress.percent)} %`
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcast({
      status: 'downloaded',
      version: info.version,
      message: `Version ${info.version} prête — redémarrez pour installer.`
    })
  })

  autoUpdater.on('error', (err) => {
    broadcast({
      status: 'error',
      message: err.message || 'Erreur de mise à jour'
    })
  })

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch(() => {
      /* réseau indisponible, ignoré */
    })
  }, 8000)
}

export async function checkForUpdatesManual(): Promise<AppUpdateState> {
  if (!app.isPackaged) {
    const state: AppUpdateState = {
      status: 'not-available',
      message: 'Les mises à jour automatiques ne sont disponibles que dans l\'application installée.'
    }
    broadcast(state)
    return state
  }

  try {
    broadcast({ status: 'checking' })
    const result = await autoUpdater.checkForUpdates()
    if (!result?.updateInfo) {
      const state: AppUpdateState = { status: 'not-available', message: 'Vous utilisez la dernière version.' }
      broadcast(state)
      return state
    }
    return { status: 'checking' }
  } catch (err) {
    const state: AppUpdateState = {
      status: 'error',
      message: err instanceof Error ? err.message : 'Impossible de vérifier les mises à jour'
    }
    broadcast(state)
    return state
  }
}

export function installUpdateNow(): void {
  autoUpdater.quitAndInstall(false, true)
}
