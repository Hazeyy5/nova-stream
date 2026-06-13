import { BrowserWindow } from 'electron'
import { join } from 'path'
import type { CapturePickerKind, CapturePickerOpenPayload } from '../../src/types'

let pickerWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null

export function setCapturePickerMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

function pickerWindowUrl(): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/capture-picker.html`
  }
  return join(__dirname, '../renderer/capture-picker.html')
}

const TITLES: Record<CapturePickerKind, string> = {
  screen: 'Choisir un écran',
  window: 'Choisir une fenêtre',
  game: 'Choisir un jeu'
}

function sendInit(win: BrowserWindow, payload: CapturePickerOpenPayload): void {
  win.setTitle(TITLES[payload.kind])
  win.webContents.send('capturePicker:init', payload)
}

export function openCapturePickerWindow(payload: CapturePickerOpenPayload): void {
  if (pickerWindow && !pickerWindow.isDestroyed()) {
    pickerWindow.focus()
    sendInit(pickerWindow, payload)
    return
  }

  pickerWindow = new BrowserWindow({
    width: 720,
    height: 560,
    minWidth: 520,
    minHeight: 420,
    title: TITLES[payload.kind],
    backgroundColor: '#161625',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  pickerWindow.on('closed', () => {
    pickerWindow = null
  })

  pickerWindow.webContents.on('did-finish-load', () => {
    if (pickerWindow && !pickerWindow.isDestroyed()) sendInit(pickerWindow, payload)
  })

  pickerWindow.loadURL(pickerWindowUrl())
}

export function closeCapturePickerWindow(): void {
  if (pickerWindow && !pickerWindow.isDestroyed()) pickerWindow.close()
}

export function forwardCaptureSelect(payload: {
  mode: 'add' | 'recapture'
  kind: CapturePickerKind
  sourceId?: string
  capture: { id: string; name: string; kind: 'screen' | 'window'; thumbnail?: string }
}): void {
  mainWindow?.webContents.send('capturePicker:select', payload)
  closeCapturePickerWindow()
}
