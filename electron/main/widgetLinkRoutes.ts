import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { IntegrationManager } from './integrations/integrationManager'

const WIDGET_IDS = ['alert', 'chat', 'followerGoal', 'subGoal', 'viewerCount', 'poll'] as const

function overlayHtmlPath(): string {
  const dev = join(__dirname, '../../docs/overlays/widget.html')
  if (existsSync(dev)) return dev
  return join(process.resourcesPath, 'docs/overlays/widget.html')
}

function parseQuery(url: string): URLSearchParams {
  const q = url.includes('?') ? url.slice(url.indexOf('?')) : ''
  return new URLSearchParams(q)
}

function parseOverlayWidget(pathname: string): string | null {
  const m = pathname.match(/^\/overlay\/([a-zA-Z]+)$/)
  const id = m?.[1]
  return id && WIDGET_IDS.includes(id as typeof WIDGET_IDS[number]) ? id : null
}

export function handleWidgetLinkRequest(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  integrations: IntegrationManager,
  pathname: string,
  method: string
): boolean {
  const query = parseQuery(req.url ?? '')

  if (method === 'GET' && pathname === '/api/widget-config') {
    const widget = query.get('widget') ?? ''
    const token = query.get('t') ?? undefined
    const config = integrations.getWidgetModuleConfig(widget, token)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: !!config, config }))
    return true
  }

  const overlayWidget = method === 'GET' ? parseOverlayWidget(pathname) : null
  if (overlayWidget) {
    const token = query.get('t') ?? ''
    try {
      let html = readFileSync(overlayHtmlPath(), 'utf-8')
      html = html.replace('__WIDGET_ID__', overlayWidget).replace('__WIDGET_TOKEN__', token)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Overlay indisponible')
    }
    return true
  }

  if (method === 'POST' && pathname === '/api/test-widget') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const data = JSON.parse(body) as {
          widget?: string
          settings?: Record<string, unknown>
          alertType?: string
        }
        if (!data.widget || !WIDGET_IDS.includes(data.widget as typeof WIDGET_IDS[number])) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, message: 'Widget invalide' }))
          return
        }
        integrations.testWidget({
          widget: data.widget,
          settings: data.settings,
          alertType: data.alertType as 'follow' | 'sub' | 'donation' | 'raid' | undefined
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur test widget'
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, message }))
      }
    })
    return true
  }

  return false
}

export { WIDGET_IDS }
