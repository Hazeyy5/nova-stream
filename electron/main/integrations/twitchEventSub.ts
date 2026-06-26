import { randomUUID } from 'crypto'
import WebSocket from 'ws'
import { getPublicTwitchClientId } from '../platformConfig'
import { ensureFreshTwitchToken } from './twitchTokenRefresh'
import type { StreamAlert } from '../../../src/types'

const WS_URL = 'wss://eventsub.wss.twitch.tv/ws'
const HELIX = 'https://api.twitch.tv/helix/eventsub/subscriptions'

interface EventSubMessage {
  metadata: {
    message_id: string
    message_type: string
    message_timestamp: string
  }
  payload: {
    session?: { id: string; reconnect_url?: string }
    subscription?: { type: string; id?: string }
    event?: Record<string, unknown>
  }
}

type WsLike = {
  close: () => void
  onmessage: ((ev: { data: string | ArrayBuffer }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
}

function createWebSocket(url: string): WsLike {
  if (typeof globalThis.WebSocket !== 'undefined') {
    return new globalThis.WebSocket(url) as unknown as WsLike
  }

  const nodeWs = new WebSocket(url)
  const adapter: WsLike = {
    onmessage: null,
    onclose: null,
    onerror: null,
    close: () => nodeWs.close()
  }

  nodeWs.on('message', (data) => {
    const payload = typeof data === 'string' ? data : data.toString()
    adapter.onmessage?.({ data: payload })
  })
  nodeWs.on('close', () => adapter.onclose?.())
  nodeWs.on('error', () => adapter.onerror?.())

  return adapter
}

export class TwitchEventSubService {
  private ws: WsLike | null = null
  private sessionId: string | null = null
  private broadcasterId = ''
  private moderatorId = ''
  private onAlert?: (alert: StreamAlert) => void
  private onStatus?: (status: { connected: boolean; subscribed: boolean; error?: string }) => void
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = true
  private subscribedTypes = new Set<string>()

  setOnAlert(callback: (alert: StreamAlert, dedupeKey?: string) => void): void {
    this.onAlert = callback
  }

  setOnStatus(callback: (status: { connected: boolean; subscribed: boolean; error?: string }) => void): void {
    this.onStatus = callback
  }

  isConnected(): boolean {
    return this.ws !== null && this.sessionId !== null
  }

  async start(accessToken: string, broadcasterId: string, moderatorId: string): Promise<void> {
    await this.stop()
    this.stopped = false
    this.broadcasterId = broadcasterId
    this.moderatorId = moderatorId
    this.subscribedTypes.clear()
    void accessToken
    this.connect(WS_URL)
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.sessionId = null
    this.subscribedTypes.clear()
    this.onStatus?.({ connected: false, subscribed: false })
  }

  private connect(url: string): void {
    if (this.stopped) return

    try {
      this.ws = createWebSocket(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WebSocket indisponible'
      console.error('[EventSub]', message)
      this.onStatus?.({ connected: false, subscribed: false, error: message })
      if (!this.stopped) {
        this.reconnectTimer = setTimeout(() => this.connect(WS_URL), 8000)
      }
      return
    }

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as EventSubMessage
        void this.handleMessage(msg)
      } catch {
        /* ignore malformed */
      }
    }

    this.ws.onclose = () => {
      this.ws = null
      this.sessionId = null
      this.subscribedTypes.clear()
      this.onStatus?.({ connected: false, subscribed: false })
      if (!this.stopped) {
        this.reconnectTimer = setTimeout(() => this.connect(WS_URL), 5000)
      }
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private async handleMessage(msg: EventSubMessage): Promise<void> {
    const type = msg.metadata.message_type

    if (type === 'session_welcome') {
      this.sessionId = msg.payload.session?.id ?? null
      if (this.sessionId) {
        this.onStatus?.({ connected: true, subscribed: false })
        await this.subscribeAll(this.sessionId)
      }
      return
    }

    if (type === 'session_reconnect') {
      const url = msg.payload.session?.reconnect_url
      if (url) {
        this.ws?.close()
        this.connect(url)
      }
      return
    }

    if (type === 'session_keepalive') {
      return
    }

    if (type === 'revocation') {
      const subType = msg.payload.subscription?.type
      if (subType) this.subscribedTypes.delete(subType)
      this.onStatus?.({ connected: true, subscribed: this.subscribedTypes.size > 0 })
      return
    }

    if (type === 'notification') {
      this.handleNotification(msg)
    }
  }

  private async clearWebSocketSubscriptions(accessToken: string, clientId: string): Promise<void> {
    let cursor: string | undefined

    try {
      do {
        const url = new URL(HELIX)
        url.searchParams.set('status', 'enabled')
        if (cursor) url.searchParams.set('after', cursor)

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': clientId
          }
        })
        if (!res.ok) break

        const json = (await res.json()) as {
          data?: Array<{ id: string; transport?: { method?: string } }>
          pagination?: { cursor?: string }
        }

        for (const sub of json.data ?? []) {
          if (sub.transport?.method !== 'websocket') continue
          await fetch(`${HELIX}/${sub.id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Client-Id': clientId
            }
          }).catch(() => { /* ignore */ })
        }

        cursor = json.pagination?.cursor
      } while (cursor)
    } catch (err) {
      console.warn('[EventSub] cleanup subscriptions:', err)
    }
  }

  private async subscribeAll(sessionId: string): Promise<void> {
    const clientId = getPublicTwitchClientId()
    const twitch = await ensureFreshTwitchToken()
    if (!clientId || !twitch) return

    await this.clearWebSocketSubscriptions(twitch.accessToken, clientId)

    const subs = [
      {
        type: 'channel.follow',
        version: '2',
        condition: {
          broadcaster_user_id: this.broadcasterId,
          moderator_user_id: this.moderatorId
        }
      },
      {
        type: 'channel.subscribe',
        version: '1',
        condition: { broadcaster_user_id: this.broadcasterId }
      },
      {
        type: 'channel.raid',
        version: '1',
        condition: { to_broadcaster_user_id: this.broadcasterId }
      },
      {
        type: 'channel.cheer',
        version: '1',
        condition: { broadcaster_user_id: this.broadcasterId }
      }
    ]

    let okCount = 0
    for (const sub of subs) {
      try {
        const res = await fetch(HELIX, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${twitch.accessToken}`,
            'Client-Id': clientId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: sub.type,
            version: sub.version,
            condition: sub.condition,
            transport: { method: 'websocket', session_id: sessionId }
          })
        })
        if (res.ok) {
          okCount += 1
          this.subscribedTypes.add(sub.type)
        } else {
          const body = await res.text().catch(() => '')
          console.warn(`[EventSub] subscription ${sub.type} failed (${res.status}):`, body.slice(0, 400))
          if (sub.type === 'channel.follow' && res.status === 403) {
            this.onStatus?.({
              connected: true,
              subscribed: okCount > 0,
              error: 'Scope moderator:read:followers manquant — déconnectez puis reconnectez Twitch dans Apps.'
            })
          }
        }
      } catch (err) {
        console.warn(`[EventSub] subscription ${sub.type} error:`, err)
      }
    }

    this.onStatus?.({ connected: true, subscribed: okCount > 0 })
    console.info(`[EventSub] ${okCount}/${subs.length} subscriptions actives`)
  }

  private handleNotification(msg: EventSubMessage): void {
    const subType = msg.payload.subscription?.type
    const event = msg.payload.event
    if (!subType || !event) return

    if (subType === 'channel.follow') {
      const username = String(event.user_name ?? event.user_login ?? 'Viewer')
      this.emit({
        id: randomUUID(),
        type: 'follow',
        platform: 'twitch',
        username,
        message: 'vient de suivre la chaîne !'
      })
      return
    }

    if (subType === 'channel.subscribe') {
      const username = String(event.user_name ?? event.user_login ?? 'Viewer')
      const tier = event.tier ? `Tier ${String(event.tier).replace('1000', '1').replace('2000', '2').replace('3000', '3')}` : 'Sub'
      this.emit({
        id: randomUUID(),
        type: 'sub',
        platform: 'twitch',
        username,
        message: "s'est abonné !",
        amount: tier
      })
      return
    }

    if (subType === 'channel.raid') {
      const username = String(event.from_broadcaster_user_name ?? event.from_broadcaster_user_login ?? 'Raider')
      const viewers = String(event.viewers ?? '?')
      this.emit({
        id: randomUUID(),
        type: 'raid',
        platform: 'twitch',
        username,
        message: `raid avec ${viewers} viewers !`,
        amount: viewers
      })
      return
    }

    if (subType === 'channel.cheer') {
      const username = String(event.user_name ?? event.user_login ?? 'Viewer')
      const bits = Number(event.bits ?? 0)
      const cheerMsg = String(event.message ?? '').trim()
      this.emit({
        id: randomUUID(),
        type: 'bits',
        platform: 'twitch',
        username,
        message: cheerMsg || `${bits} bits !`,
        amount: `${bits} bits`
      }, `bits:${String(event.id ?? username)}:${bits}`)
    }
  }

  private emit(alert: StreamAlert, dedupeKey?: string): void {
    this.onAlert?.(alert, dedupeKey)
  }
}
