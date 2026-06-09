import { contextBridge, ipcRenderer } from 'electron'
import type {
  StreamSettings,
  MediaState,
  DisplaySource,
  MediaDevice,
  PlatformConnectionPublic,
  ChatMessage,
  FeedEvent,
  StreamAlert,
  AlertType,
  SpeedtestResult,
  CaptureSourceOption
} from '../../src/types'

const api = {
  media: {
    start: (payload: {
      settings: StreamSettings
      stream: boolean
      record: boolean
    }) => ipcRenderer.invoke('media:start', payload),
    stop: () => ipcRenderer.invoke('media:stop'),
    sendVideoChunk: (chunk: Uint8Array) => ipcRenderer.send('media:video-chunk', chunk),
    getStatus: () => ipcRenderer.invoke('media:getStatus') as Promise<MediaState>,
    isActive: () => ipcRenderer.invoke('media:isActive') as Promise<boolean>,
    onStatusChange: (callback: (state: MediaState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: MediaState) => callback(state)
      ipcRenderer.on('media:status', handler)
      return () => ipcRenderer.removeListener('media:status', handler)
    }
  },
  devices: {
    getDisplays: () => ipcRenderer.invoke('devices:getDisplays') as Promise<DisplaySource[]>,
    getCaptureSources: (kind: 'screen' | 'window' | 'all') =>
      ipcRenderer.invoke('devices:getCaptureSources', kind) as Promise<CaptureSourceOption[]>,
    listMedia: () => ipcRenderer.invoke('devices:listMedia') as Promise<MediaDevice[]>
  },
  dialog: {
    selectRecordingFolder: () => ipcRenderer.invoke('dialog:selectRecordingFolder') as Promise<string | null>
  },
  speedtest: {
    run: (resolution: string, framerate: number, audioBitrate: number) =>
      ipcRenderer.invoke('speedtest:run', { resolution, framerate, audioBitrate }) as Promise<SpeedtestResult>,
    onProgress: (callback: (percent: number) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, percent: number) => callback(percent)
      ipcRenderer.on('speedtest:progress', handler)
      return () => ipcRenderer.removeListener('speedtest:progress', handler)
    }
  },
  link: {
    getPort: () => ipcRenderer.invoke('link:getPort') as Promise<number>
  },
  platform: {
    getConfig: () => ipcRenderer.invoke('platform:getConfig') as Promise<{
      appName: string
      websiteUrl: string
      githubUrl: string
    }>
  },
  integrations: {
    getConnections: () => ipcRenderer.invoke('integrations:getConnections') as Promise<PlatformConnectionPublic[]>,
    isTwitchConfigured: () => ipcRenderer.invoke('integrations:isTwitchConfigured') as Promise<boolean>,
    connectTwitch: () => ipcRenderer.invoke('integrations:connectTwitch') as Promise<{
      success: boolean
      connection?: PlatformConnectionPublic
      message?: string
    }>,
    disconnect: (platform: 'twitch' | 'kick') => ipcRenderer.invoke('integrations:disconnect', platform),
    getMessages: () => ipcRenderer.invoke('integrations:getMessages') as Promise<ChatMessage[]>,
    getFeed: () => ipcRenderer.invoke('integrations:getFeed') as Promise<FeedEvent[]>,
    clearFeed: () => ipcRenderer.invoke('integrations:clearFeed') as Promise<{ success: boolean }>,
    getAlerts: () => ipcRenderer.invoke('integrations:getAlerts') as Promise<StreamAlert[]>,
    testAlert: (type?: AlertType) => ipcRenderer.invoke('integrations:testAlert', type),
    onChatMessage: (callback: (msg: ChatMessage) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, msg: ChatMessage) => callback(msg)
      ipcRenderer.on('chat:message', handler)
      return () => ipcRenderer.removeListener('chat:message', handler)
    },
    onFeedEvent: (callback: (event: FeedEvent) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, event: FeedEvent) => callback(event)
      ipcRenderer.on('feed:event', handler)
      return () => ipcRenderer.removeListener('feed:event', handler)
    },
    onFeedCleared: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('feed:cleared', handler)
      return () => ipcRenderer.removeListener('feed:cleared', handler)
    },
    onAlert: (callback: (alert: StreamAlert) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, alert: StreamAlert) => callback(alert)
      ipcRenderer.on('alert:show', handler)
      return () => ipcRenderer.removeListener('alert:show', handler)
    },
    onAlertDismiss: (callback: (id: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, id: string) => callback(id)
      ipcRenderer.on('alert:dismiss', handler)
      return () => ipcRenderer.removeListener('alert:dismiss', handler)
    },
    onUpdated: (callback: (connections: PlatformConnectionPublic[]) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, conns: PlatformConnectionPublic[]) => callback(conns)
      ipcRenderer.on('integrations:updated', handler)
      return () => ipcRenderer.removeListener('integrations:updated', handler)
    }
  }
}

contextBridge.exposeInMainWorld('novaStream', api)

export type NovaStreamAPI = typeof api
