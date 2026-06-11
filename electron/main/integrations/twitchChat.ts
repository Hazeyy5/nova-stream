import { randomUUID } from 'crypto'
import tmi from 'tmi.js'
import type { ChatMessage, StreamAlert } from '../../../src/types'

export class TwitchChatService {
  private client: tmi.Client | null = null
  private channel: string | null = null
  private login: string | null = null
  private ready = false
  private onMessage?: (msg: ChatMessage) => void
  private onAlert?: (alert: StreamAlert) => void
  private recentAlertKeys = new Set<string>()

  setOnMessage(callback: (msg: ChatMessage) => void): void {
    this.onMessage = callback
  }

  setOnAlert(callback: (alert: StreamAlert) => void): void {
    this.onAlert = callback
  }

  private emitAlertOnce(key: string, alert: StreamAlert): void {
    if (this.recentAlertKeys.has(key)) return
    this.recentAlertKeys.add(key)
    setTimeout(() => this.recentAlertKeys.delete(key), 8000)
    this.onAlert?.(alert)
  }

  async connect(username: string, accessToken: string): Promise<void> {
    await this.disconnect()

    const login = username.toLowerCase()
    this.channel = login
    this.login = login
    this.ready = false

    this.client = new tmi.Client({
      options: { debug: false, messagesLogLevel: 'info' },
      connection: { reconnect: true, secure: true },
      identity: {
        username: login,
        password: `oauth:${accessToken}`
      },
      channels: [login]
    })

    this.client.on('connected', () => {
      this.ready = true
    })

    this.client.on('disconnected', () => {
      this.ready = false
    })

    this.client.on('message', (_channel, tags, message, self) => {
      if (self) return
      this.onMessage?.({
        id: tags.id ?? `${Date.now()}`,
        platform: 'twitch',
        username: tags['display-name'] ?? tags.username ?? 'Anonyme',
        message,
        color: tags.color ?? '#a970ff',
        timestamp: Date.now(),
        badges: tags.badges ? Object.keys(tags.badges) : []
      })
    })

    this.client.on('subscription', (_channel, username, methods, message) => {
      const plan = methods.planName ?? methods.plan ?? 'Sub'
      this.emitAlertOnce(`sub:${username}`, {
        id: randomUUID(),
        type: 'sub',
        platform: 'twitch',
        username,
        message: message || "s'est abonné !",
        amount: plan
      })
    })

    this.client.on('raided', (_channel, username, viewers) => {
      this.emitAlertOnce(`raid:${username}:${viewers}`, {
        id: randomUUID(),
        type: 'raid',
        platform: 'twitch',
        username,
        message: `raid avec ${viewers} viewers !`,
        amount: String(viewers)
      })
    })

    await this.client.connect()
    this.ready = true
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.client || !this.channel) {
      throw new Error('Chat Twitch non connecté')
    }
    if (!this.ready) {
      throw new Error('Connexion au chat en cours — réessayez dans un instant')
    }

    const channel = this.channel.startsWith('#') ? this.channel : `#${this.channel}`
    await Promise.race([
      this.client.say(channel, message),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Délai dépassé — vérifiez votre connexion Twitch')), 8000)
      })
    ])
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect()
      this.client = null
    }
    this.channel = null
    this.login = null
    this.ready = false
  }

  isConnected(): boolean {
    return this.ready && this.client !== null
  }

  getLogin(): string | null {
    return this.login
  }
}
