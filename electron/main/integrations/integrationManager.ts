import { BrowserWindow } from 'electron'
import { connectTwitch, isTwitchConfigured } from './twitchAuth'
import { getPublicConnections, getToken, removeConnection, saveConnection } from './authStore'
import { TwitchChatService } from './twitchChat'
import { sendTwitchChatViaHelix } from './twitchChatSend'
import { fetchTwitchStreamKey } from './twitchStreamKey'
import {
  getTwitchChannelInfo,
  searchTwitchCategories,
  updateTwitchChannelInfo
} from './twitchChannel'
import { ensureFreshTwitchToken } from './twitchTokenRefresh'
import { TwitchEventSubService } from './twitchEventSub'
import { AlertManager } from './alertManager'
import { fetchTwitchWidgetStats } from './twitchWidgetStats'
import type { ChatMessage, FeedEvent, PlatformConnectionPublic, StreamAlert, WidgetLiveData } from '../../../src/types'

export class IntegrationManager {
  private chat = new TwitchChatService()
  private eventSub = new TwitchEventSubService()
  private alerts = new AlertManager()
  private messages: ChatMessage[] = []
  private feedEvents: FeedEvent[] = []
  private activeAlerts: StreamAlert[] = []
  private chatAccessToken: string | null = null
  private widgetLiveData: WidgetLiveData = {
    viewerCount: 0,
    followerCount: 0,
    subCount: 0,
    live: false
  }
  private widgetStatsTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.chat.setOnMessage((msg) => {
      this.messages = [...this.messages.slice(-99), msg]
      this.broadcast('chat:message', msg)
    })

    this.chat.setOnAlert((alert) => this.showAlert(alert))
    this.eventSub.setOnAlert((alert) => this.showAlert(alert))
    this.alerts.setOnAlert((alert) => this.showAlert(alert))
  }

  private showAlert(alert: StreamAlert): void {
    const stamped = { ...alert, shownAt: alert.shownAt ?? Date.now() }
    this.activeAlerts = [...this.activeAlerts, stamped]
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
      platform: alert.platform ?? 'twitch',
      icon: icons[alert.type],
      text: labels[alert.type],
      timestamp: Date.now()
    })
    this.broadcast('alert:show', stamped)
    setTimeout(() => {
      this.activeAlerts = this.activeAlerts.filter((a) => a.id !== stamped.id)
      this.broadcast('alert:dismiss', stamped.id)
    }, 5000)
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
    const twitch = await ensureFreshTwitchToken()
    if (!twitch) return false

    const tokenChanged = this.chatAccessToken !== twitch.accessToken
    if (this.chat.isConnected() && !tokenChanged) return true

    try {
      await this.chat.connect(twitch.username, twitch.accessToken)
      this.chatAccessToken = twitch.accessToken
      return true
    } catch {
      this.chatAccessToken = null
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
    this.alerts.stopDemo()
    await this.chat.connect(conn.username, conn.accessToken)
    this.chatAccessToken = conn.accessToken
    void this.eventSub.start(conn.accessToken, conn.userId, conn.userId).catch(() => {
      /* EventSub optionnel si scopes manquants */
    })
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
    this.startWidgetStatsPolling()
    return pub
  }

  async disconnect(platform: 'twitch' | 'kick'): Promise<void> {
    if (platform === 'twitch') {
      await this.chat.disconnect()
      await this.eventSub.stop()
      this.chatAccessToken = null
      this.stopWidgetStatsPolling()
      this.widgetLiveData = { viewerCount: 0, followerCount: 0, subCount: 0, live: false }
      this.broadcast('widget:stats', this.widgetLiveData)
    }
    removeConnection(platform)
    const hasConnection = getPublicConnections().length > 0
    if (!hasConnection) this.alerts.startDemo()
    this.broadcast('integrations:updated', this.getConnections())
  }

  async restoreSessions(): Promise<void> {
    const twitch = getToken('twitch')
    if (twitch) {
      this.alerts.stopDemo()
      try {
        await this.chat.connect(twitch.username, twitch.accessToken)
        this.chatAccessToken = twitch.accessToken
        void this.eventSub.start(twitch.accessToken, twitch.userId, twitch.userId).catch(() => {})
        this.startWidgetStatsPolling()
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

  getWidgetLiveData(): WidgetLiveData {
    return { ...this.widgetLiveData }
  }

  private stopWidgetStatsPolling(): void {
    if (this.widgetStatsTimer) {
      clearInterval(this.widgetStatsTimer)
      this.widgetStatsTimer = null
    }
  }

  private async refreshWidgetStats(): Promise<void> {
    const stats = await fetchTwitchWidgetStats()
    this.widgetLiveData = stats
    this.broadcast('widget:stats', stats)
  }

  private startWidgetStatsPolling(): void {
    this.stopWidgetStatsPolling()
    void this.refreshWidgetStats()
    this.widgetStatsTimer = setInterval(() => {
      void this.refreshWidgetStats()
    }, 30_000)
  }

  testAlert(type?: StreamAlert['type']): void {
    this.alerts.triggerTest(type)
  }

  async getTwitchStreamKey(): Promise<string> {
    return fetchTwitchStreamKey()
  }

  async getTwitchChannelInfo() {
    return getTwitchChannelInfo()
  }

  async searchTwitchCategories(query: string) {
    return searchTwitchCategories(query)
  }

  async updateTwitchChannelInfo(title: string, categoryId: string) {
    return updateTwitchChannelInfo(title, categoryId)
  }

  async sendChatMessage(text: string): Promise<{ success: boolean; message?: string }> {
    const trimmed = text.trim()
    if (!trimmed) return { success: false, message: 'Message vide' }

    const twitch = await ensureFreshTwitchToken()
    if (!twitch) {
      return { success: false, message: 'Connectez votre compte Twitch dans Apps.' }
    }

    const ready = await this.ensureChatConnected()
    if (!ready) {
      return {
        success: false,
        message: 'Chat Twitch indisponible. Déconnectez puis reconnectez Twitch dans Apps.'
      }
    }

    let sent = false
    let lastError = 'Impossible d\'envoyer le message'

    try {
      await this.chat.sendMessage(trimmed)
      sent = true
    } catch (ircErr) {
      lastError = ircErr instanceof Error ? ircErr.message : lastError
    }

    if (!sent) {
      try {
        await sendTwitchChatViaHelix(trimmed)
        sent = true
      } catch (helixErr) {
        lastError = helixErr instanceof Error ? helixErr.message : lastError
      }
    }

    if (!sent) {
      const needsReconnect =
        lastError.includes('Login authentication failed') ||
        lastError.includes('Permission') ||
        lastError.includes('403') ||
        lastError.includes('401')
      return {
        success: false,
        message: needsReconnect
          ? 'Permission d\'envoi manquante — déconnectez puis reconnectez Twitch dans Apps (cochez l\'accès chat à l\'écriture).'
          : lastError
      }
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
  }
}
