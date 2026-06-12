import type { ChatMessage, StreamAlert, WebWidgetSettings, WidgetLiveData } from '../../../src/types'

export class WidgetModuleStore {
  private settings: WebWidgetSettings = {}
  private token: string | null = null

  setToken(token: string | undefined): void {
    if (token?.trim()) this.token = token.trim()
  }

  getToken(): string | null {
    return this.token
  }

  setSettings(settings: WebWidgetSettings): void {
    this.settings = settings
  }

  getSettings(): WebWidgetSettings {
    return this.settings
  }

  isAuthorized(token: string | undefined): boolean {
    if (!token) return false
    return !!this.token && token === this.token
  }

  getWidgetConfig(widget: string, token: string | undefined): unknown {
    if (!this.isAuthorized(token)) return null
    return (this.settings as Record<string, unknown>)[widget] ?? null
  }
}

export function buildTestWidgetPayload(
  widget: string,
  settings?: Record<string, unknown>,
  alertType?: StreamAlert['type']
): { widget: string; settings?: Record<string, unknown>; alertType?: StreamAlert['type'] } {
  return { widget, settings, alertType }
}

export function createTestChatMessage(): ChatMessage {
  return {
    id: `test-chat-${Date.now()}`,
    platform: 'twitch',
    username: 'TestViewer',
    message: 'Message test — configuré depuis le tableau de bord web ✨',
    color: '#a78bfa',
    timestamp: Date.now()
  }
}

export function createDemoWidgetStats(): WidgetLiveData {
  return {
    viewerCount: 1284,
    followerCount: 720,
    subCount: 9,
    live: true
  }
}
