import { BrowserWindow } from 'electron'
import { join } from 'path'
import type { Source } from '../../src/types'

const windows = new Map<string, BrowserWindow>()
let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win
  win.on('closed', () => {
    mainWindow = null
    closeAllSourcePropertiesWindows()
  })
}

function propsWindowUrl(): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/source-props.html`
  }
  return join(__dirname, '../renderer/source-props.html')
}

function sendInit(win: BrowserWindow, source: Source): void {
  win.setTitle(`Propriétés — ${source.name}`)
  win.webContents.send('sourceProps:init', source)
}

export function openSourcePropertiesWindow(source: Source): void {
  const existing = windows.get(source.id)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    sendInit(existing, source)
    return
  }

  const win = new BrowserWindow({
    width: 480,
    height: 580,
    minWidth: 380,
    minHeight: 420,
    title: `Propriétés — ${source.name}`,
    backgroundColor: '#161625',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  windows.set(source.id, win)

  win.on('closed', () => {
    windows.delete(source.id)
    mainWindow?.webContents.send('sourceProps:closed', source.id)
  })

  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed()) sendInit(win, source)
  })

  win.loadURL(propsWindowUrl())
}

export function syncSourcePropertiesWindow(source: Source): void {
  const win = windows.get(source.id)
  if (win && !win.isDestroyed()) {
    win.setTitle(`Propriétés — ${source.name}`)
    win.webContents.send('sourceProps:sync', source)
  }
}

export function closeSourcePropertiesWindow(sourceId: string): void {
  const win = windows.get(sourceId)
  if (win && !win.isDestroyed()) win.close()
}

export function closeAllSourcePropertiesWindows(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.close()
  }
  windows.clear()
}

export function forwardPatch(sourceId: string, partial: Partial<Source>): void {
  mainWindow?.webContents.send('sourceProps:applyPatch', { sourceId, partial })
}

export function forwardRecapture(sourceId: string, kind: 'screen' | 'window'): void {
  mainWindow?.webContents.send('sourceProps:openRecapture', { sourceId, kind })
}
