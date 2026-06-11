import { randomUUID } from 'crypto'
import { getPublicTwitchClientId } from '../platformConfig'
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
    subscription?: { type: string }
    event?: Record<string, unknown>
  }
}

export class TwitchEventSubService {
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private accessToken = ''
  private broadcasterId = ''
  private moderatorId = ''
  private onAlert?: (alert: StreamAlert) => void
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = true

  setOnAlert(callback: (alert: StreamAlert) => void): void {
    this.onAlert = callback
  }

  async start(accessToken: string, broadcasterId: string, moderatorId: string): Promise<void> {
    await this.stop()
    this.stopped = false
    this.accessToken = accessToken
    this.broadcasterId = broadcasterId
    this.moderatorId = moderatorId
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
  }

  private connect(url: string): void {
    if (this.stopped) return

    this.ws = new WebSocket(url)

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

    if (type === 'notification') {
      this.handleNotification(msg)
    }
  }

  private async subscribeAll(sessionId: string): Promise<void> {
    const clientId = getPublicTwitchClientId()
    if (!clientId) return

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
      }
    ]

    for (const sub of subs) {
      try {
        await fetch(HELIX, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
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
      } catch {
        /* subscription may already exist or scope missing */
      }
    }
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
    }
  }

  private emit(alert: StreamAlert): void {
    this.onAlert?.(alert)
  }
}
