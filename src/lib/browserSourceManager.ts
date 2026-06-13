import type { StreamEntry } from './drawScene'

interface BrowserHandle {
  sourceId: string
  image: HTMLImageElement
  timer: ReturnType<typeof setTimeout> | null
  webview: ElectronWebviewElement
  capturing: boolean
  objectUrl: string | null
  frameVersion: number
}

interface ElectronWebviewElement extends HTMLElement {
  src: string
  capturePage: () => Promise<ElectronNativeImage>
  addEventListener(type: 'dom-ready' | 'did-finish-load' | 'did-fail-load', listener: () => void): void
  removeEventListener(type: 'dom-ready' | 'did-finish-load' | 'did-fail-load', listener: () => void): void
}

interface ElectronNativeImage {
  toJPEG: (quality: number) => Uint8Array
  toDataURL: () => string
  getSize: () => { width: number; height: number }
}

const pool = new Map<string, BrowserHandle>()
const CAPTURE_INTERVAL_MS = 500
const WEBVIEW_W = 1280
const WEBVIEW_H = 720
const BROWSER_PARTITION = 'persist:nova-browser-sources'
const WEBVIEW_PREFS = 'contextIsolation=yes,javascript=yes,images=yes,webgl=yes'

function hostElement(): HTMLElement {
  let el = document.getElementById('nova-browser-sources-host')
  if (!el) {
    el = document.createElement('div')
    el.id = 'nova-browser-sources-host'
    el.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:1280px',
      'height:720px',
      'overflow:hidden',
      'opacity:0.01',
      'pointer-events:none',
      'z-index:-1'
    ].join(';')
    document.body.appendChild(el)
  }
  return el
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return 'about:blank'
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function setImageFromBuffer(handle: BrowserHandle, buffer: Uint8Array): Promise<void> {
  if (buffer.byteLength < 64) return Promise.resolve()

  if (handle.objectUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(handle.objectUrl)
  }

  const blob = new Blob([buffer], { type: 'image/jpeg' })
  const url = URL.createObjectURL(blob)
  handle.objectUrl = url
  handle.frameVersion += 1

  return new Promise((resolve) => {
    const onLoad = () => {
      handle.image.removeEventListener('load', onLoad)
      handle.image.removeEventListener('error', onLoad)
      resolve()
    }
    handle.image.addEventListener('load', onLoad)
    handle.image.addEventListener('error', onLoad)
    handle.image.src = url
  })
}

function scheduleCapture(handle: BrowserHandle, refresh: () => Promise<void>): void {
  if (handle.timer) clearTimeout(handle.timer)
  handle.timer = setTimeout(async () => {
    await refresh()
    if (pool.has(handle.sourceId)) {
      scheduleCapture(handle, refresh)
    }
  }, CAPTURE_INTERVAL_MS)
}

async function captureWebviewBitmap(webview: ElectronWebviewElement): Promise<Uint8Array | null> {
  try {
    const bitmap = await webview.capturePage()
    const size = bitmap.getSize?.()
    if (size && (size.width <= 0 || size.height <= 0)) return null

    if (typeof bitmap.toJPEG === 'function') {
      const buf = bitmap.toJPEG(80)
      return buf.byteLength > 64 ? buf : null
    }

    const dataUrl = bitmap.toDataURL()
    if (!dataUrl.startsWith('data:image')) return null
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes.byteLength > 64 ? bytes : null
  } catch {
    return null
  }
}

async function waitForWebviewReady(webview: ElectronWebviewElement): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      webview.removeEventListener('dom-ready', done)
      webview.removeEventListener('did-finish-load', done)
      resolve()
    }
    webview.addEventListener('dom-ready', done)
    webview.addEventListener('did-finish-load', done)
    setTimeout(done, 5000)
  })
}

async function captureWithRetries(webview: ElectronWebviewElement, attempts = 12): Promise<Uint8Array | null> {
  for (let i = 0; i < attempts; i++) {
    const buf = await captureWebviewBitmap(webview)
    if (buf) return buf
    await new Promise((r) => setTimeout(r, 350))
  }
  return null
}

export async function acquireBrowserSource(sourceId: string, url: string): Promise<StreamEntry> {
  releaseBrowserSource(sourceId)

  const image = new Image()
  const webview = document.createElement('webview') as ElectronWebviewElement
  webview.setAttribute('partition', BROWSER_PARTITION)
  webview.setAttribute('allowpopups', '')
  webview.setAttribute('webpreferences', WEBVIEW_PREFS)
  webview.style.width = `${WEBVIEW_W}px`
  webview.style.height = `${WEBVIEW_H}px`
  webview.src = normalizeUrl(url)
  hostElement().appendChild(webview)

  const handle: BrowserHandle = {
    sourceId,
    image,
    timer: null,
    webview,
    capturing: false,
    objectUrl: null,
    frameVersion: 0
  }

  const refresh = async () => {
    if (handle.capturing) return
    handle.capturing = true
    try {
      const buffer = await captureWebviewBitmap(webview)
      if (buffer) await setImageFromBuffer(handle, buffer)
    } finally {
      handle.capturing = false
    }
  }

  await waitForWebviewReady(webview)
  const firstFrame = await captureWithRetries(webview)
  if (firstFrame) await setImageFromBuffer(handle, firstFrame)

  scheduleCapture(handle, refresh)
  pool.set(sourceId, handle)

  return { sourceId, stream: null, video: null, image }
}

export function releaseBrowserSource(sourceId: string): void {
  const handle = pool.get(sourceId)
  if (!handle) return
  if (handle.timer) clearTimeout(handle.timer)
  if (handle.objectUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(handle.objectUrl)
  }
  handle.webview.remove()
  pool.delete(sourceId)
}

export function releaseAllBrowserSources(): void {
  for (const id of [...pool.keys()]) releaseBrowserSource(id)
}
