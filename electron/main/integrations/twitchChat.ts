import tmi from 'tmi.js'
import type { ChatMessage } from '../../../src/types'

export class TwitchChatService {
  private client: tmi.Client | null = null
  private onMessage?: (msg: ChatMessage) => void

  setOnMessage(callback: (msg: ChatMessage) => void): void {
    this.onMessage = callback
  }

  async connect(username: string, accessToken: string): Promise<void> {
    await this.disconnect()

    this.client = new tmi.Client({
      options: { debug: false, messagesLogLevel: 'info' },
      connection: { reconnect: true, secure: true },
      identity: {
        username,
        password: `oauth:${accessToken}`
      },
      channels: [username]
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

    await this.client.connect()
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect()
      this.client = null
    }
  }

  isConnected(): boolean {
    return this.client !== null
  }
}
