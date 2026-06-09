export type VideoEncoder = 'x264' | 'nvenc'
export type TransitionType = 'cut' | 'fade'
export type ScaleMode = 'stretch' | 'fit' | 'fill'
export type BlendMode = 'normal' | 'multiply' | 'screen'
export type SourceType = 'display' | 'screen' | 'window' | 'browser' | 'webcam' | 'image' | 'text' | 'chat' | 'alert'
export type PlatformId = 'twitch' | 'kick'
export type AppView = 'editor' | 'integrations'

export interface PlatformConnection {
  platform: PlatformId
  userId: string
  username: string
  displayName: string
  avatarUrl?: string
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  connectedAt: number
}

export interface PlatformConnectionPublic {
  platform: PlatformId
  userId: string
  username: string
  displayName: string
  avatarUrl?: string
  connectedAt: number
}

export interface ChatMessage {
  id: string
  platform: PlatformId
  username: string
  message: string
  color?: string
  timestamp: number
  badges?: string[]
}

export type AlertType = 'follow' | 'sub' | 'donation' | 'raid'

export interface StreamAlert {
  id: string
  type: AlertType
  platform?: PlatformId
  username: string
  message?: string
  amount?: string
}

export interface FeedEvent {
  id: string
  type: 'chat' | 'alert' | 'system' | 'follow' | 'sub'
  platform: PlatformId | 'system'
  icon: string
  text: string
  timestamp: number
  color?: string
}

export interface SourceTransform {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
}

export interface Source {
  id: string
  name: string
  type: SourceType
  visible: boolean
  locked: boolean
  transform: SourceTransform
  volume: number
  muted: boolean
  imageUrl?: string
  textContent?: string
  captureId?: string
  captureName?: string
  browserUrl?: string
  scaleMode?: ScaleMode
  blendMode?: BlendMode
  flipH?: boolean
  flipV?: boolean
}

export interface Scene {
  id: string
  name: string
  sources: Source[]
}

export interface StreamSettings {
  rtmpUrl: string
  streamKey: string
  resolution: string
  framerate: number
  videoBitrate: number
  audioBitrate: number
  encoder: VideoEncoder
  audioEnabled: boolean
  audioDevice: string
  /** Gain du micro en dB (0 = unity, jusqu'à +20 dB). */
  audioGainDb: number
  /** Downmix stéréo → mono pour le micro (stream / enregistrement). */
  micMono: boolean
  /** @deprecated migré vers audioGainDb */
  audioVolume?: number
  /** Gain Desktop Audio en dB. */
  desktopAudioGainDb: number
  /** @deprecated migré vers desktopAudioGainDb */
  desktopAudioVolume?: number
  desktopAudioEnabled: boolean
  desktopAudioDevice: string
  desktopAudioCaptureDevice?: string
  desktopAudioBackend?: 'native' | 'dshow'
  webcamDevice: string
  recordingEnabled: boolean
  recordAudioEnabled: boolean
  recordingPath: string
  transition: TransitionType
  transitionDuration: number
}

export type AudioChannelId = 'mic' | 'desktop'

export interface AudioChannelPropsPayload {
  channel: AudioChannelId
  settings: StreamSettings
}

export type StreamStatus = 'idle' | 'starting' | 'live' | 'stopping' | 'error'
export type RecordingStatus = 'idle' | 'recording' | 'stopping'

export interface StreamState {
  status: StreamStatus
  message?: string
  startedAt?: number
}

export interface RecordingState {
  status: RecordingStatus
  filePath?: string
  startedAt?: number
}

export interface MediaState {
  stream: StreamState
  recording: RecordingState
}

export interface DisplaySource {
  id: string
  name: string
  displayId: string
  thumbnail?: string
}

export interface CaptureSourceOption {
  id: string
  name: string
  kind: 'screen' | 'window'
  thumbnail?: string
}

export interface MediaDevice {
  name: string
  type: 'audio' | 'video'
  audioRole?: 'input' | 'output' | 'loopback'
  deviceId?: string
  backend?: 'dshow' | 'browser' | 'native'
  isDefault?: boolean
}

export interface SpeedtestResult {
  uploadMbps: number
  recommendedVideoBitrate: number
  platformMaxKbps: number
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  message: string
}

export interface SceneStreamConfig {
  sources: Source[]
  resolution: string
}

export const DEFAULT_SOURCE_TRANSFORM: Record<SourceType, SourceTransform> = {
  display: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 },
  screen: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 },
  window: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 },
  browser: { x: 0, y: 0, width: 100, height: 100, zIndex: 2 },
  webcam: { x: 72, y: 68, width: 22, height: 22, zIndex: 10 },
  image: { x: 10, y: 10, width: 30, height: 30, zIndex: 5 },
  text: { x: 5, y: 85, width: 40, height: 10, zIndex: 15 },
  chat: { x: 1, y: 62, width: 28, height: 36, zIndex: 20 },
  alert: { x: 30, y: 8, width: 40, height: 18, zIndex: 25 }
}

export function createSource(type: SourceType, name?: string): Source {
  const labels: Record<SourceType, string> = {
    display: 'Capture écran',
    screen: 'Écran',
    window: 'Fenêtre',
    browser: 'Navigateur',
    webcam: 'Webcam',
    image: 'Image',
    text: 'Texte',
    chat: 'Chat Box',
    alert: 'Alert Box'
  }
  return {
    id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name ?? labels[type],
    type,
    visible: true,
    locked: false,
    transform: { ...DEFAULT_SOURCE_TRANSFORM[type] },
    volume: 100,
    muted: false,
    scaleMode: 'stretch',
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    textContent: type === 'text' ? 'Bienvenue sur le stream !' : undefined
  }
}

export const DEFAULT_STREAM_SETTINGS: StreamSettings = {
  rtmpUrl: 'rtmp://live.twitch.tv/app',
  streamKey: '',
  resolution: '1920x1080',
  framerate: 30,
  videoBitrate: 4500,
  audioBitrate: 160,
  encoder: 'x264',
  audioEnabled: false,
  audioDevice: '',
  audioGainDb: 0,
  micMono: false,
  desktopAudioGainDb: 0,
  desktopAudioEnabled: false,
  desktopAudioDevice: '',
  webcamDevice: '',
  recordingEnabled: false,
  recordAudioEnabled: true,
  recordingPath: '',
  transition: 'fade',
  transitionDuration: 300
}
