import { BrowserWindow } from 'electron'
import { connectTwitch, isTwitchConfigured } from './twitchAuth'
import { getPublicConnections, getToken, removeConnection, saveConnection } from './authStore'
import { TwitchChatService } from './twitchChat'
import { sendTwitchChatViaHelix } from './twitchChatSend'
import { AlertManager } from './alertManager'
import type { ChatMessage, FeedEvent, PlatformConnectionPublic, StreamAlert } from '../../../src/types'

export class IntegrationManager {
  private chat = new TwitchChatService()
  private alerts = new AlertManager()
  private messages: ChatMessage[] = []
  private feedEvents: FeedEvent[] = []
  private activeAlerts: StreamAlert[] = []

  constructor() {
    this.chat.setOnMessage((msg) => {
      this.messages = [...this.messages.slice(-99), msg]
      this.broadcast('chat:message', msg)
    })

    this.alerts.setOnAlert((alert) => {
      this.activeAlerts = [...this.activeAlerts, alert]
      const icons = { follow: '💜', sub: '⭐', donation: '💰', raid: '🚀' }
      const feedType = alert.type === 'follow' || alert.type === 'sub' ? alert.type : 'alert'
      const labels = {
        follow: `${alert.username} a suivi la chaîne`,
        sub: `${alert.username} s'est abonné`,
        donation: alert.message ?? `${alert.username} a fait un don`,
        raid: alert.message ?? `${alert.username} raid !`
      }
      this.addFeedEvent({
        id: alert.id,
        type: feedType,
        platform: 'twitch',
        icon: icons[alert.type],
        text: labels[alert.type],
        timestamp: Date.now()
      })
      this.broadcast('alert:show', alert)
      setTimeout(() => {
        this.activeAlerts = this.activeAlerts.filter((a) => a.id !== alert.id)
        this.broadcast('alert:dismiss', alert.id)
      }, 5000)
    })
  }

  private addFeedEvent(event: FeedEvent): void {
    this.feedEvents = [event, ...this.feedEvents].slice(0, 50)
    this.broadcast('feed:event', event)
  }

  private broadcast(channel: string, data: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, data)
    }
  }

  getConnections(): PlatformConnectionPublic[] {
    return getPublicConnections()
  }

  getChatStatus(): {
    linked: boolean
    chatConnected: boolean
    canSend: boolean
    username?: string
  } {
    const twitch = getToken('twitch')
    const chatConnected = this.chat.isConnected()
    return {
      linked: !!twitch,
      chatConnected,
      canSend: !!twitch && chatConnected,
      username: twitch?.displayName
    }
  }

  private async ensureChatConnected(): Promise<boolean> {
    if (this.chat.isConnected()) return true
    const twitch = getToken('twitch')
    if (!twitch) return false
    try {
      await this.chat.connect(twitch.username, twitch.accessToken)
      return true
    } catch {
      return false
    }
  }

  isTwitchConfigured(): boolean {
    return isTwitchConfigured()
  }

  async connectTwitch(): Promise<PlatformConnectionPublic> {
    const conn = await connectTwitch()
    return this.activateTwitchConnection(conn)
  }

  async linkTwitchFromWeb(data: {
    accessToken: string
    refreshToken?: string
    expiresIn?: number
    userId: string
    username: string
    displayName: string
    avatarUrl?: string
  }): Promise<PlatformConnectionPublic> {
    const conn = {
      platform: 'twitch' as const,
      userId: data.userId,
      username: data.username,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresIn ? Date.now() + data.expiresIn * 1000 : undefined,
      connectedAt: Date.now()
    }
    saveConnection('twitch', conn)
    this.alerts.stopDemo()
    return this.activateTwitchConnection(conn)
  }

  private async activateTwitchConnection(conn: {
    platform: 'twitch'
    userId: string
    username: string
    displayName: string
    avatarUrl?: string
    accessToken: string
    connectedAt: number
  }): Promise<PlatformConnectionPublic> {
    await this.chat.connect(conn.username, conn.accessToken)
    this.addFeedEvent({
      id: `connect-${Date.now()}`,
      type: 'system',
      platform: 'twitch',
      icon: '✅',
      text: `Connecté en tant que ${conn.displayName}`,
      timestamp: Date.now()
    })
    const pub = {
      platform: 'twitch' as const,
      userId: conn.userId,
      username: conn.username,
      displayName: conn.displayName,
      avatarUrl: conn.avatarUrl,
      connectedAt: conn.connectedAt
    }
    this.broadcast('integrations:updated', this.getConnections())
    return pub
  }

  async disconnect(platform: 'twitch' | 'kick'): Promise<void> {
    if (platform === 'twitch') {
      await this.chat.disconnect()
    }
    removeConnection(platform)
    this.broadcast('integrations:updated', this.getConnections())
  }

  async restoreSessions(): Promise<void> {
    const twitch = getToken('twitch')
    if (twitch) {
      try {
        await this.chat.connect(twitch.username, twitch.accessToken)
      } catch { /* token expired */ }
    }
    const hasConnection = getPublicConnections().length > 0
    if (!hasConnection) this.alerts.startDemo()
  }

  getMessages(): ChatMessage[] {
    return this.messages
  }

  getFeedEvents(): FeedEvent[] {
    return this.feedEvents.filter((e) => e.type !== 'chat')
  }

  clearFeedEvents(): void {
    this.feedEvents = []
    this.broadcast('feed:cleared', null)
  }

  getActiveAlerts(): StreamAlert[] {
    return this.activeAlerts
  }

  testAlert(type?: StreamAlert['type']): void {
    this.alerts.triggerTest(type)
  }

  async sendChatMessage(text: string): Promise<{ success: boolean; message?: string }> {
    const trimmed = text.trim()
    if (!trimmed) return { success: false, message: 'Message vide' }

    const twitch = getToken('twitch')
    if (!twitch) {
      return { success: false, message: 'Connectez votre compte Twitch dans Apps.' }
    }

    const ready = await this.ensureChatConnected()
    if (!ready) {
      return {
        success: false,
        message: 'Chat Twitch indisponible. Déconnectez puis reconnectez Twitch dans Apps (permission d\'écriture requise).'
      }
    }

    try {
      try {
        await sendTwitchChatViaHelix(trimmed)
      } catch (helixErr) {
        if (helixErr instanceof Error && helixErr.message.includes('Permission')) {
          throw helixErr
        }
        await this.chat.sendMessage(trimmed)
      }
      const msg: ChatMessage = {
        id: `local-${Date.now()}`,
        platform: 'twitch',
        username: twitch.displayName,
        message: trimmed,
        color: '#a78bfa',
        timestamp: Date.now()
      }
      this.messages = [...this.messages.slice(-99), msg]
      this.broadcast('chat:message', msg)
      return { success: true }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Impossible d\'envoyer le message'
      const message = raw.includes('Login authentication failed') || raw.includes('403')
        ? 'Permission chat manquante — reconnectez Twitch dans Apps pour autoriser l\'envoi de messages.'
        : raw
      return { success: false, message }
    }
  }
}
