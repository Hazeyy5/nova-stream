import { createServer, type Server } from 'http'
import type { IntegrationManager } from './integrationManager'

const LINK_PORT = 3847
const ALLOWED_ORIGINS = [
  'https://hazeyy5.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
]

export class LinkServer {
  private server: Server | null = null

  constructor(private integrations: IntegrationManager) {}

  start(): void {
    if (this.server) return

    this.server = createServer(async (req, res) => {
      const origin = req.headers.origin ?? ''
      const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

      res.setHeader('Access-Control-Allow-Origin', corsOrigin)
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Vary', 'Origin')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      if (req.method === 'GET' && req.url === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          online: true,
          app: 'Nova Stream',
          version: '0.5.0',
          connections: this.integrations.getConnections()
        }))
        return
      }

      if (req.method === 'POST' && req.url === '/api/link') {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', async () => {
          try {
            const data = JSON.parse(body)
            if (data.platform !== 'twitch') {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, message: 'Plateforme non supportée' }))
              return
            }
            const conn = await this.integrations.linkTwitchFromWeb({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              expiresIn: data.expiresIn,
              userId: data.userId,
              username: data.username,
              displayName: data.displayName,
              avatarUrl: data.avatarUrl,
              widgetSettings: data.widgetSettings
            })
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true, connection: conn }))
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Erreur de liaison'
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, message }))
          }
        })
        return
      }

      if (req.method === 'POST' && req.url === '/api/widget-settings') {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const data = JSON.parse(body)
            if (!data.settings || typeof data.settings !== 'object') {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, message: 'Paramètres invalides' }))
              return
            }
            this.integrations.applyWebWidgetSettings(data.settings)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true }))
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Erreur de synchronisation'
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, message }))
          }
        })
        return
      }

      res.writeHead(404)
      res.end()
    })

    this.server.listen(LINK_PORT, '127.0.0.1')
  }

  stop(): void {
    this.server?.close()
    this.server = null
  }

  getPort(): number {
    return LINK_PORT
  }
}
