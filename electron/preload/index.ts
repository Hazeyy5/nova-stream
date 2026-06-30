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
  CaptureSourceOption,
  CapturePickerKind,
  CapturePickerOpenPayload,
  Source,
  WidgetLiveData,
  TwitchCategory,
  TwitchChannelInfo,
  WebWidgetSettings,
  DonationSettings,
  TtsSettings,
  EncoderRecommendation
} from '../../src/types'
import type { AudioChannelId, AudioChannelPropsPayload } from '../../src/types'

const api = {
  media: {
    start: (payload: {
      settings: StreamSettings
      stream: boolean
      record: boolean
      videoInputFormat?: 'h264' | 'webm'
    }) => ipcRenderer.invoke('media:start', payload),
    stop: () => ipcRenderer.invoke('media:stop'),
    sendVideoChunk: (chunk: Uint8Array, durationMs?: number) =>
      ipcRenderer.send('media:video-chunk', { chunk, durationMs }),
    getStatus: () => ipcRenderer.invoke('media:getStatus') as Promise<MediaState>,
    isActive: () => ipcRenderer.invoke('media:isActive') as Promise<boolean>,
    getHealth: () => ipcRenderer.invoke('media:getHealth') as Promise<{
      ffmpegRunning: boolean
      videoFlowing: boolean
      lastVideoChunkAgeMs: number
      videoChunksTotal: number
    }>,
    markPipelineReady: () => ipcRenderer.send('media:pipeline-ready'),
    updateAudioSettings: (settings: StreamSettings) =>
      ipcRenderer.invoke('media:updateAudioSettings', settings) as Promise<{ success: boolean }>,
    updateMixerSettings: (settings: StreamSettings) =>
      ipcRenderer.invoke('media:updateMixerSettings', settings) as Promise<{ success: boolean }>,
    onStatusChange: (callback: (state: MediaState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: MediaState) => callback(state)
      ipcRenderer.on('media:status', handler)
      return () => ipcRenderer.removeListener('media:status', handler)
    }
  },
  devices: {
    getDisplays: () => ipcRenderer.invoke('devices:getDisplays') as Promise<DisplaySource[]>,
    getCaptureSources: (kind: CapturePickerKind | 'all') =>
      ipcRenderer.invoke('devices:getCaptureSources', kind) as Promise<CaptureSourceOption[]>,
    listMedia: () => ipcRenderer.invoke('devices:listMedia') as Promise<MediaDevice[]>
  },
  system: {
    scanEncoders: () => ipcRenderer.invoke('system:scanEncoders') as Promise<{
      success: boolean
      recommendation?: EncoderRecommendation
      message?: string
    }>
  },
  dialog: {
    selectRecordingFolder: () => ipcRenderer.invoke('dialog:selectRecordingFolder') as Promise<string | null>,
    saveImage: (dataUrl: string) =>
      ipcRenderer.invoke('dialog:saveImage', dataUrl) as Promise<string | null>,
    importScenesFile: () => ipcRenderer.invoke('dialog:importScenesFile') as Promise<string | null>,
    selectImageFile: () => ipcRenderer.invoke('dialog:selectImageFile') as Promise<string | null>,
    readImageFile: (filePath: string) =>
      ipcRenderer.invoke('dialog:readImageFile', filePath) as Promise<string | null>
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
      version: string
      websiteUrl: string
      githubUrl: string
    }>,
    openExternal: (url: string) =>
      ipcRenderer.invoke('platform:openExternal', url) as Promise<{ success: boolean; message?: string }>
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
    getWidgetLiveData: () => ipcRenderer.invoke('integrations:getWidgetLiveData') as Promise<WidgetLiveData>,
    testAlert: (type?: AlertType) => ipcRenderer.invoke('integrations:testAlert', type),
    sendChatMessage: (text: string) =>
      ipcRenderer.invoke('integrations:sendChatMessage', text) as Promise<{ success: boolean; message?: string }>,
    getChatStatus: () => ipcRenderer.invoke('integrations:getChatStatus') as Promise<{
      linked: boolean
      chatConnected: boolean
      canSend: boolean
      username?: string
    }>,
    fetchTwitchStreamKey: () =>
      ipcRenderer.invoke('integrations:fetchTwitchStreamKey') as Promise<{
        success: boolean
        streamKey?: string
        message?: string
      }>,
    getTwitchChannelInfo: () =>
      ipcRenderer.invoke('integrations:getTwitchChannelInfo') as Promise<{
        success: boolean
        info?: TwitchChannelInfo
        message?: string
      }>,
    searchTwitchCategories: (query: string) =>
      ipcRenderer.invoke('integrations:searchTwitchCategories', query) as Promise<{
        success: boolean
        categories?: TwitchCategory[]
        message?: string
      }>,
    fetchTopTwitchCategories: (limit?: number) =>
      ipcRenderer.invoke('integrations:fetchTopTwitchCategories', limit) as Promise<{
        success: boolean
        categories?: TwitchCategory[]
        message?: string
      }>,
    updateTwitchChannelInfo: (payload: { title: string; categoryId: string }) =>
      ipcRenderer.invoke('integrations:updateTwitchChannelInfo', payload) as Promise<{
        success: boolean
        message?: string
      }>,
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
    onWidgetStats: (callback: (data: WidgetLiveData) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: WidgetLiveData) => callback(data)
      ipcRenderer.on('widget:stats', handler)
      return () => ipcRenderer.removeListener('widget:stats', handler)
    },
    onUpdated: (callback: (connections: PlatformConnectionPublic[]) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, conns: PlatformConnectionPublic[]) => callback(conns)
      ipcRenderer.on('integrations:updated', handler)
      return () => ipcRenderer.removeListener('integrations:updated', handler)
    },
    onWebWidgetSettings: (callback: (settings: WebWidgetSettings) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, settings: WebWidgetSettings) => callback(settings)
      ipcRenderer.on('widgets:settings', handler)
      return () => ipcRenderer.removeListener('widgets:settings', handler)
    },
    getWebWidgetSettings: () =>
      ipcRenderer.invoke('integrations:getWebWidgetSettings') as Promise<WebWidgetSettings>,
    patchDonationSettings: (partial: Partial<DonationSettings>) =>
      ipcRenderer.invoke('integrations:patchDonationSettings', partial) as Promise<WebWidgetSettings>,
    patchTtsSettings: (partial: Partial<TtsSettings>) =>
      ipcRenderer.invoke('integrations:patchTtsSettings', partial) as Promise<WebWidgetSettings>,
    onTtsSpeak: (callback: (payload: {
      text: string
      blockedWords?: string[]
      options?: { voiceName?: string; rate?: number; pitch?: number; volume?: number }
    }) => void) => {
      const handler = (_: unknown, data: {
        text: string
        blockedWords?: string[]
        options?: { voiceName?: string; rate?: number; pitch?: number; volume?: number }
      }) => callback(data)
      ipcRenderer.on('tts:speak', handler)
      return () => ipcRenderer.removeListener('tts:speak', handler)
    }
  },
  sourceProps: {
    open: (source: Source) => ipcRenderer.invoke('sourceProps:open', source),
    sync: (source: Source) => ipcRenderer.invoke('sourceProps:sync', source),
    close: (sourceId: string) => ipcRenderer.invoke('sourceProps:close', sourceId),
    ready: () => ipcRenderer.send('sourceProps:ready'),
    patch: (sourceId: string, partial: Partial<Source>) => {
      ipcRenderer.send('sourceProps:patch', { sourceId, partial })
    },
    requestRecapture: (sourceId: string, kind: CapturePickerKind) => {
      ipcRenderer.send('sourceProps:recapture', { sourceId, kind })
    },
    onInit: (callback: (source: Source) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, source: Source) => callback(source)
      ipcRenderer.on('sourceProps:init', handler)
      return () => ipcRenderer.removeListener('sourceProps:init', handler)
    },
    onSync: (callback: (source: Source) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, source: Source) => callback(source)
      ipcRenderer.on('sourceProps:sync', handler)
      return () => ipcRenderer.removeListener('sourceProps:sync', handler)
    },
    onApplyPatch: (callback: (payload: { sourceId: string; partial: Partial<Source> }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, payload: { sourceId: string; partial: Partial<Source> }) => callback(payload)
      ipcRenderer.on('sourceProps:applyPatch', handler)
      return () => ipcRenderer.removeListener('sourceProps:applyPatch', handler)
    },
    onOpenRecapture: (callback: (payload: { sourceId: string; kind: CapturePickerKind }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, payload: { sourceId: string; kind: CapturePickerKind }) => callback(payload)
      ipcRenderer.on('sourceProps:openRecapture', handler)
      return () => ipcRenderer.removeListener('sourceProps:openRecapture', handler)
    },
    onClosed: (callback: (sourceId: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, sourceId: string) => callback(sourceId)
      ipcRenderer.on('sourceProps:closed', handler)
      return () => ipcRenderer.removeListener('sourceProps:closed', handler)
    }
  },
  audioProps: {
    open: (channel: AudioChannelId, settings: StreamSettings) =>
      ipcRenderer.invoke('audioProps:open', { channel, settings }),
    sync: (channel: AudioChannelId, settings: StreamSettings) =>
      ipcRenderer.invoke('audioProps:sync', { channel, settings }),
    close: (channel: AudioChannelId) => ipcRenderer.invoke('audioProps:close', channel),
    ready: () => ipcRenderer.send('audioProps:ready'),
    patch: (partial: Partial<StreamSettings>) => {
      ipcRenderer.send('audioProps:patch', partial)
    },
    onInit: (callback: (payload: AudioChannelPropsPayload) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, payload: AudioChannelPropsPayload) => callback(payload)
      ipcRenderer.on('audioProps:init', handler)
      return () => ipcRenderer.removeListener('audioProps:init', handler)
    },
    onSync: (callback: (payload: AudioChannelPropsPayload) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, payload: AudioChannelPropsPayload) => callback(payload)
      ipcRenderer.on('audioProps:sync', handler)
      return () => ipcRenderer.removeListener('audioProps:sync', handler)
    },
    onApplyPatch: (callback: (partial: Partial<StreamSettings>) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, partial: Partial<StreamSettings>) => callback(partial)
      ipcRenderer.on('audioProps:applyPatch', handler)
      return () => ipcRenderer.removeListener('audioProps:applyPatch', handler)
    },
    onClosed: (callback: (channel: AudioChannelId) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, channel: AudioChannelId) => callback(channel)
      ipcRenderer.on('audioProps:closed', handler)
      return () => ipcRenderer.removeListener('audioProps:closed', handler)
    }
  },
  audioMeter: {
    subscribeDesktop: () => ipcRenderer.invoke('audioMeter:subscribeDesktop'),
    unsubscribeDesktop: () => ipcRenderer.invoke('audioMeter:unsubscribeDesktop'),
    onDesktopLevel: (callback: (level: {
      peak: number
      rms: number
      peakDb: number
      displayDb: number
    }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, level: {
        peak: number
        rms: number
        peakDb: number
        displayDb: number
      }) => callback(level)
      ipcRenderer.on('audioMeter:desktop', handler)
      return () => ipcRenderer.removeListener('audioMeter:desktop', handler)
    },
    subscribeStream: () => ipcRenderer.invoke('audioMeter:subscribeStream'),
    unsubscribeStream: () => ipcRenderer.invoke('audioMeter:unsubscribeStream'),
    onStreamLevel: (callback: (levels: {
      mic: { peak: number; rms: number; peakDb: number; displayDb: number }
      desktop: { peak: number; rms: number; peakDb: number; displayDb: number }
    }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, levels: {
        mic: { peak: number; rms: number; peakDb: number; displayDb: number }
        desktop: { peak: number; rms: number; peakDb: number; displayDb: number }
      }) => callback(levels)
      ipcRenderer.on('audioMeter:stream', handler)
      return () => ipcRenderer.removeListener('audioMeter:stream', handler)
    }
  },
  updates: {
    getState: () => ipcRenderer.invoke('updates:getState') as Promise<{
      status: string
      version?: string
      progress?: number
      message?: string
    }>,
    check: () => ipcRenderer.invoke('updates:check') as Promise<void>,
    install: () => ipcRenderer.invoke('updates:install') as Promise<{ success: boolean }>,
    onState: (callback: (state: {
      status: string
      version?: string
      progress?: number
      message?: string
    }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, state: {
        status: string
        version?: string
        progress?: number
        message?: string
      }) => callback(state)
      ipcRenderer.on('updates:state', handler)
      return () => ipcRenderer.removeListener('updates:state', handler)
    }
  },
  capturePicker: {
    open: (payload: CapturePickerOpenPayload) => ipcRenderer.invoke('capturePicker:open', payload),
    ready: () => ipcRenderer.send('capturePicker:ready'),
    select: (payload: {
      mode: 'add' | 'recapture'
      kind: CapturePickerKind
      sourceId?: string
      capture: CaptureSourceOption
    }) => ipcRenderer.send('capturePicker:select', payload),
    cancel: () => ipcRenderer.send('capturePicker:cancel'),
    onInit: (callback: (payload: CapturePickerOpenPayload) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, payload: CapturePickerOpenPayload) => callback(payload)
      ipcRenderer.on('capturePicker:init', handler)
      return () => ipcRenderer.removeListener('capturePicker:init', handler)
    },
    onSelect: (callback: (payload: {
      mode: 'add' | 'recapture'
      kind: CapturePickerKind
      sourceId?: string
      capture: CaptureSourceOption
    }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, payload: {
        mode: 'add' | 'recapture'
        kind: CapturePickerKind
        sourceId?: string
        capture: CaptureSourceOption
      }) => callback(payload)
      ipcRenderer.on('capturePicker:select', handler)
      return () => ipcRenderer.removeListener('capturePicker:select', handler)
    }
  }
}

contextBridge.exposeInMainWorld('novaStream', api)

export type NovaStreamAPI = typeof api
