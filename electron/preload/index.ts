import { contextBridge, ipcRenderer } from 'electron'
import type {
  StreamSettings,
  MediaState,
  DisplaySource,
  MediaDevice,
  SceneStreamConfig,
  PlatformConnectionPublic,
  ChatMessage,
  FeedEvent,
  StreamAlert,
  AlertType
} from '../../src/types'

const api = {
  media: {
    start: (payload: {
      settings: StreamSettings
      scene: SceneStreamConfig
      stream: boolean
      record: boolean
    }) => ipcRenderer.invoke('media:start', payload),
    stop: () => ipcRenderer.invoke('media:stop'),
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
    listMedia: () => ipcRenderer.invoke('devices:listMedia') as Promise<MediaDevice[]>
  },
  dialog: {
    selectRecordingFolder: () => ipcRenderer.invoke('dialog:selectRecordingFolder') as Promise<string | null>
  },
  link: {
    getPort: () => ipcRenderer.invoke('link:getPort') as Promise<number>
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
