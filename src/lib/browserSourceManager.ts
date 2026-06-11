import type { StreamEntry } from './drawScene'

interface BrowserHandle {
  sourceId: string
  image: HTMLImageElement
  timer: ReturnType<typeof setTimeout> | null
  webview: HTMLElement
  capturing: boolean
  objectUrl: string | null
}

const pool = new Map<string, BrowserHandle>()
const CAPTURE_INTERVAL_MS = 2000
const WEBVIEW_W = 960
const WEBVIEW_H = 540

function hostElement(): HTMLElement {
  let el = document.getElementById('nova-browser-sources-host')
  if (!el) {
    el = document.createElement('div')
    el.id = 'nova-browser-sources-host'
    el.style.cssText = 'position:fixed;left:-10000px;top:0;width:960px;height:540px;overflow:hidden;opacity:0;pointer-events:none'
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

function setImageFromBuffer(handle: BrowserHandle, buffer: Uint8Array): void {
  if (handle.objectUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(handle.objectUrl)
  }
  const blob = new Blob([buffer], { type: 'image/jpeg' })
  const url = URL.createObjectURL(blob)
  handle.image.src = url
  handle.objectUrl = url
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

export async function acquireBrowserSource(sourceId: string, url: string): Promise<StreamEntry> {
  releaseBrowserSource(sourceId)

  const image = new Image()

  const webview = document.createElement('webview') as HTMLElement & {
    src: string
    capturePage: () => Promise<{ toJPEG: (quality: number) => Uint8Array; toDataURL: () => string }>
  }
  webview.setAttribute('webpreferences', 'contextIsolation=yes')
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
    objectUrl: null
  }

  const refresh = async () => {
    if (handle.capturing || document.hidden) return
    handle.capturing = true
    try {
      const bitmap = await webview.capturePage()
      if (typeof bitmap.toJPEG === 'function') {
        setImageFromBuffer(handle, bitmap.toJPEG(75))
      } else {
        const dataUrl = bitmap.toDataURL()
        if (handle.objectUrl?.startsWith('blob:')) URL.revokeObjectURL(handle.objectUrl)
        handle.image.src = dataUrl
        handle.objectUrl = null
      }
    } catch { /* page loading */ }
    finally {
      handle.capturing = false
    }
  }

  await new Promise<void>((resolve) => {
    const done = () => { resolve(); webview.removeEventListener('dom-ready', done) }
    webview.addEventListener('dom-ready', done)
    setTimeout(resolve, 2000)
  })
  await refresh()

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
