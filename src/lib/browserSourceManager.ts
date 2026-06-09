import type { StreamEntry } from './drawScene'

interface BrowserHandle {
  image: HTMLImageElement
  interval: ReturnType<typeof setInterval>
  webview: HTMLElement
  capturing: boolean
  objectUrl: string | null
}

const pool = new Map<string, BrowserHandle>()
const CAPTURE_INTERVAL_MS = 1000

function hostElement(): HTMLElement {
  let el = document.getElementById('nova-browser-sources-host')
  if (!el) {
    el = document.createElement('div')
    el.id = 'nova-browser-sources-host'
    el.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:720px;overflow:hidden;opacity:0;pointer-events:none'
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

function setImageFromDataUrl(handle: BrowserHandle, dataUrl: string): void {
  if (handle.objectUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(handle.objectUrl)
  }
  handle.image.src = dataUrl
  handle.objectUrl = null
}

export async function acquireBrowserSource(sourceId: string, url: string): Promise<StreamEntry> {
  releaseBrowserSource(sourceId)

  const image = new Image()
  const webview = document.createElement('webview') as HTMLElement & {
    src: string
    capturePage: () => Promise<{ toDataURL: () => string }>
  }
  webview.setAttribute('webpreferences', 'contextIsolation=yes')
  webview.style.width = '1280px'
  webview.style.height = '720px'
  webview.src = normalizeUrl(url)
  hostElement().appendChild(webview)

  const handle: BrowserHandle = {
    image,
    interval: 0 as unknown as ReturnType<typeof setInterval>,
    webview,
    capturing: false,
    objectUrl: null
  }

  const refresh = async () => {
    if (handle.capturing || document.hidden) return
    handle.capturing = true
    try {
      const bitmap = await webview.capturePage()
      setImageFromDataUrl(handle, bitmap.toDataURL())
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

  handle.interval = setInterval(refresh, CAPTURE_INTERVAL_MS)
  pool.set(sourceId, handle)

  return { sourceId, stream: null, video: null, image }
}

export function releaseBrowserSource(sourceId: string): void {
  const handle = pool.get(sourceId)
  if (!handle) return
  clearInterval(handle.interval)
  if (handle.objectUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(handle.objectUrl)
  }
  handle.webview.remove()
  pool.delete(sourceId)
}

export function releaseAllBrowserSources(): void {
  for (const id of [...pool.keys()]) releaseBrowserSource(id)
}
