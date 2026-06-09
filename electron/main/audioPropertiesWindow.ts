import { BrowserWindow } from 'electron'
import { join } from 'path'
import type { AudioChannelId, AudioChannelPropsPayload, StreamSettings } from '../../src/types'

const windows = new Map<AudioChannelId, BrowserWindow>()
let mainWindow: BrowserWindow | null = null

const CHANNEL_LABELS: Record<AudioChannelId, string> = {
  mic: 'Mic/Aux',
  desktop: 'Desktop Audio'
}

export function setAudioPropsMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

function propsWindowUrl(): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/audio-props.html`
  }
  return join(__dirname, '../renderer/audio-props.html')
}

function sendInit(win: BrowserWindow, payload: AudioChannelPropsPayload): void {
  win.setTitle(`Propriétés — ${CHANNEL_LABELS[payload.channel]}`)
  win.webContents.send('audioProps:init', payload)
}

export function openAudioPropertiesWindow(channel: AudioChannelId, settings: StreamSettings): void {
  const existing = windows.get(channel)
  const payload: AudioChannelPropsPayload = { channel, settings }

  if (existing && !existing.isDestroyed()) {
    existing.focus()
    sendInit(existing, payload)
    return
  }

  const win = new BrowserWindow({
    width: 420,
    height: channel === 'mic' ? 440 : 340,
    minWidth: 340,
    minHeight: 280,
    title: `Propriétés — ${CHANNEL_LABELS[channel]}`,
    backgroundColor: '#161625',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  windows.set(channel, win)

  win.on('closed', () => {
    windows.delete(channel)
    mainWindow?.webContents.send('audioProps:closed', channel)
  })

  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed()) sendInit(win, payload)
  })

  win.loadURL(propsWindowUrl())
}

export function syncAudioPropertiesWindow(channel: AudioChannelId, settings: StreamSettings): void {
  const win = windows.get(channel)
  if (win && !win.isDestroyed()) {
    win.setTitle(`Propriétés — ${CHANNEL_LABELS[channel]}`)
    win.webContents.send('audioProps:sync', { channel, settings })
  }
}

export function closeAudioPropertiesWindow(channel: AudioChannelId): void {
  const win = windows.get(channel)
  if (win && !win.isDestroyed()) win.close()
}

export function closeAllAudioPropertiesWindows(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.close()
  }
  windows.clear()
}

export function forwardAudioSettingsPatch(partial: Partial<StreamSettings>): void {
  mainWindow?.webContents.send('audioProps:applyPatch', partial)
}
