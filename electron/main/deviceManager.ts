import { spawn } from 'child_process'
import type { BrowserWindow } from 'electron'
import ffmpegPath from 'ffmpeg-static'
import { isNativeAudioAvailable, listNativeMediaDevices, listNativeVideoDevicesFromDshow } from './nativeAudioDevices'
import type { MediaDevice, StreamSettings } from '../../src/types'

const LOOPBACK_NAME_RE =
  /st[eé]r[eé]o mix|mixage st[eé]r[eé]o|what u hear|cable output|loopback|virtual cable|vb-audio|wave out|sortie|output \(/i

const INPUT_NAME_RE =
  /microphone|micro\b|\bmic\b|headset input|line in|entr[eé]e|input \(/i

function classifyDshowAudio(name: string): MediaDevice['audioRole'] {
  if (LOOPBACK_NAME_RE.test(name)) return 'loopback'
  if (INPUT_NAME_RE.test(name)) return 'input'
  return 'input'
}

async function listDshowDevices(): Promise<MediaDevice[]> {
  if (!ffmpegPath) return []

  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], {
      windowsHide: true
    })

    let output = ''
    proc.stderr.on('data', (chunk: Buffer) => { output += chunk.toString() })
    proc.on('close', () => resolve(parseDshowDevices(output)))
    proc.on('error', () => resolve([]))

    setTimeout(() => {
      proc.kill()
      resolve(parseDshowDevices(output))
    }, 5000)
  })
}

function parseDshowDevices(output: string): MediaDevice[] {
  const devices: MediaDevice[] = []
  const seen = new Set<string>()
  let currentType: 'audio' | 'video' | null = null

  for (const line of output.split('\n')) {
    if (line.includes('Alternative name')) continue

    const inlineMatch = line.match(/"([^"]+)"\s*\((video|audio)\)/)
    if (inlineMatch) {
      const type = inlineMatch[2] as 'audio' | 'video'
      const key = `${type}:${inlineMatch[1]}`
      if (!seen.has(key)) {
        seen.add(key)
        devices.push({
          name: inlineMatch[1],
          type,
          backend: 'dshow',
          audioRole: type === 'audio' ? classifyDshowAudio(inlineMatch[1]) : undefined
        })
      }
      continue
    }

    if (line.includes('DirectShow video devices')) currentType = 'video'
    else if (line.includes('DirectShow audio devices')) currentType = 'audio'
    else {
      const match = line.match(/"([^"]+)"/)
      if (match && currentType) {
        const key = `${currentType}:${match[1]}`
        if (!seen.has(key)) {
          seen.add(key)
          devices.push({
            name: match[1],
            type: currentType,
            backend: 'dshow',
            audioRole: currentType === 'audio' ? classifyDshowAudio(match[1]) : undefined
          })
        }
      }
    }
  }

  return devices
}

async function listBrowserAudioDevices(mainWindow: BrowserWindow | null): Promise<MediaDevice[]> {
  if (isNativeAudioAvailable() || !mainWindow || mainWindow.isDestroyed()) return []

  try {
    return await mainWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
          probe.getTracks().forEach(t => t.stop())
        } catch {}

        const devices = await navigator.mediaDevices.enumerateDevices()
        return devices
          .filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput')
          .map(d => ({
            name: d.label || (d.kind === 'audiooutput' ? 'Sortie audio' : 'Entrée audio'),
            type: 'audio',
            audioRole: d.kind === 'audiooutput' ? 'output' : 'input',
            deviceId: d.deviceId,
            backend: 'browser'
          }))
      })()
    `) as MediaDevice[]
  } catch {
    return []
  }
}

function mergeKey(d: MediaDevice): string {
  return `${d.type}:${d.audioRole ?? ''}:${d.name}`
}

function mergeDeviceLists(...lists: MediaDevice[][]): MediaDevice[] {
  const merged = new Map<string, MediaDevice>()

  for (const list of lists) {
    for (const device of list) {
      const existing = merged.get(mergeKey(device))
      if (!existing) {
        merged.set(mergeKey(device), device)
        continue
      }
      merged.set(mergeKey(device), {
        ...existing,
        ...device,
        deviceId: device.deviceId ?? existing.deviceId,
        isDefault: device.isDefault ?? existing.isDefault,
        backend: device.backend === 'native' ? 'native' : existing.backend
      })
    }
  }

  return [...merged.values()]
}

let mediaListWindow: BrowserWindow | null = null

export function setMediaListWindow(win: BrowserWindow | null): void {
  mediaListWindow = win
}

export async function listDshowMediaDevices(): Promise<MediaDevice[]> {
  return listDshowDevices()
}

export async function listMediaDevices(mainWindow: BrowserWindow | null = null): Promise<MediaDevice[]> {
  const windowRef = mainWindow ?? mediaListWindow
  const dshow = await listDshowDevices()
  const dshowMics = dshow.filter((d) => d.type === 'audio' && d.audioRole === 'input')
  const dshowLoopbacks = dshow.filter((d) => d.type === 'audio' && d.audioRole === 'loopback')

  if (isNativeAudioAvailable()) {
    const native = await listNativeMediaDevices()
    const video = listNativeVideoDevicesFromDshow(dshow)
    return mergeDeviceLists(video, native, dshowMics, dshowLoopbacks)
  }

  const browser = await listBrowserAudioDevices(windowRef)
  return mergeDeviceLists(dshow, browser)
}

function resolveFfmpegMicName(selected: string, dshowDevices: MediaDevice[]): string {
  const dshowMics = dshowDevices.filter((d) => d.type === 'audio' && d.audioRole === 'input')
  if (selected && dshowMics.some((d) => d.name === selected)) return selected
  return dshowMics[0]?.name ?? ''
}

export function getMicDevices(devices: MediaDevice[]): MediaDevice[] {
  return devices.filter(
    (d) => d.type === 'audio' && d.audioRole === 'input'
  )
}

export function getDesktopAudioDevices(devices: MediaDevice[]): MediaDevice[] {
  const outputs = devices.filter((d) => d.type === 'audio' && d.audioRole === 'output')
  const loopbacks = devices.filter((d) => d.type === 'audio' && d.audioRole === 'loopback')

  const seen = new Set<string>()
  const result: MediaDevice[] = []
  for (const device of [...outputs, ...loopbacks]) {
    if (!seen.has(device.name)) {
      seen.add(device.name)
      result.push(device)
    }
  }
  return result
}

function resolveDesktopBackend(device: MediaDevice | undefined): 'native' | 'dshow' {
  if (!device) return isNativeAudioAvailable() ? 'native' : 'dshow'
  if (device.audioRole === 'loopback' || device.backend === 'dshow') return 'dshow'
  if (device.audioRole === 'output' && isNativeAudioAvailable()) return 'native'
  return 'dshow'
}

export function resolveDesktopCaptureName(
  selected: string,
  devices: MediaDevice[],
  backend: 'native' | 'dshow'
): string {
  if (!selected) return ''
  if (backend === 'native') return selected

  const dshowMatch = devices.find(
    (d) => d.type === 'audio' && d.backend === 'dshow' && d.name === selected
  )
  if (dshowMatch) return dshowMatch.name

  const loopbacks = devices.filter(
    (d) => d.type === 'audio' && d.backend === 'dshow' && d.audioRole === 'loopback'
  )
  if (loopbacks.length > 0) return loopbacks[0].name

  return selected
}

export function resolveStreamSettings(
  settings: StreamSettings,
  devices: MediaDevice[],
  dshowDevices: MediaDevice[] = []
): StreamSettings {
  const videoDevices = devices.filter((d) => d.type === 'video')
  const micDevices = getMicDevices(devices)
  const desktopDevices = getDesktopAudioDevices(devices)

  const pickDevice = (current: string, available: MediaDevice[]) =>
    current && available.some((d) => d.name === current) ? current : available[0]?.name ?? ''

  const selectedMic = settings.audioEnabled
    ? pickDevice(settings.audioDevice, micDevices)
    : ''

  const ffmpegMic = settings.audioEnabled
    ? resolveFfmpegMicName(selectedMic, dshowDevices.length > 0 ? dshowDevices : devices)
    : ''

  const desktopAudioDevice = settings.desktopAudioEnabled
    ? pickDevice(settings.desktopAudioDevice, desktopDevices)
    : ''

  const selectedDesktop = devices.find(
    (d) => d.type === 'audio' && d.name === desktopAudioDevice
  )
  const desktopAudioBackend = settings.desktopAudioEnabled
    ? resolveDesktopBackend(selectedDesktop)
    : undefined

  const desktopAudioCaptureDevice = settings.desktopAudioEnabled
    ? resolveDesktopCaptureName(desktopAudioDevice, devices, desktopAudioBackend ?? 'dshow')
    : ''

  return {
    ...settings,
    webcamDevice: settings.webcamDevice && videoDevices.some((d) => d.name === settings.webcamDevice)
      ? settings.webcamDevice
      : '',
    audioDevice: ffmpegMic,
    audioEnabled: settings.audioEnabled && !!ffmpegMic,
    desktopAudioDevice,
    desktopAudioEnabled: settings.desktopAudioEnabled && !!desktopAudioDevice,
    desktopAudioBackend,
    desktopAudioCaptureDevice
  }
}
