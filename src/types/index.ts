export type VideoEncoder = 'x264' | 'nvenc' | 'amf' | 'qsv'

export interface GpuInfo {
  name: string
  vendor: 'nvidia' | 'amd' | 'intel' | 'other'
  vramBytes: number
  discrete: boolean
}

export interface EncoderOptionInfo {
  id: VideoEncoder
  label: string
  available: boolean
  description: string
}

export interface EncoderRecommendation {
  recommended: VideoEncoder
  reason: string
  gpus: GpuInfo[]
  cpuName: string
  cpuCores: number
  availableEncoders: VideoEncoder[]
  options: EncoderOptionInfo[]
  scannedAt: number
}
export type TransitionType = 'cut' | 'fade'
export type ScaleMode = 'stretch' | 'fit' | 'fill'
export type BlendMode = 'normal' | 'multiply' | 'screen'
export type SourceMaskShape = 'none' | 'rounded' | 'circle'
export type ChatBoxStyle = 'classic' | 'minimal' | 'neon' | 'bubble' | 'retro'
export type AlertBoxStyle = 'classic' | 'minimal' | 'neon' | 'banner' | 'celebration' | 'sleek'
export type AlertAnimation = 'pop' | 'slideUp' | 'slideLeft' | 'bounce' | 'fadeScale' | 'pulse'
export type GoalWidgetStyle = 'classic' | 'bar' | 'minimal' | 'neon'
export type PollWidgetStyle = 'classic' | 'bars'
export type SourceType =
  | 'display' | 'screen' | 'window' | 'game' | 'browser' | 'webcam' | 'image' | 'text'
  | 'chat' | 'alert' | 'followerGoal' | 'subGoal' | 'viewerCount' | 'poll'
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

export type AlertType = 'follow' | 'sub' | 'donation' | 'raid' | 'bits'

export interface StreamAlert {
  id: string
  type: AlertType
  platform?: PlatformId
  username: string
  message?: string
  amount?: string
  /** Titre personnalisé (ex. libellé don). */
  title?: string
  /** Horodatage d'affichage (ms) pour les animations. */
  shownAt?: number
  /** GIF Giphy choisi par le donateur (don premium). */
  gifUrl?: string
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

export interface ChromaKeySettings {
  enabled: boolean
  color: string
  similarity: number
  smoothness: number
}

export interface WidgetLiveData {
  viewerCount: number
  followerCount: number
  subCount: number
  live: boolean
}

export const DEFAULT_WIDGET_LIVE_DATA: WidgetLiveData = {
  viewerCount: 0,
  followerCount: 0,
  subCount: 0,
  live: false
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
  /** Chemin local (Windows) pour les images importées depuis le disque. */
  imageLocalPath?: string
  textContent?: string
  captureId?: string
  captureName?: string
  /** Caméra utilisée pour cette source webcam (nom DirectShow / navigateur). */
  webcamDevice?: string
  browserUrl?: string
  scaleMode?: ScaleMode
  blendMode?: BlendMode
  flipH?: boolean
  flipV?: boolean
  chromaKey?: ChromaKeySettings
  /** Masque visuel (webcam, captures, images). */
  maskShape?: SourceMaskShape
  /** Rayon du masque en % de la plus petite dimension (0–50). */
  maskRadius?: number
  /** Filtres visuels — 100 = neutre. */
  brightness?: number
  contrast?: number
  saturation?: number
  blur?: number
  /** Opacité 0–100 (défaut 100). */
  opacity?: number
  chatStyle?: ChatBoxStyle
  /** Nombre de messages affichés dans la chat box (1–12). */
  chatMaxMessages?: number
  alertStyle?: AlertBoxStyle
  alertAnimation?: AlertAnimation
  /** Widgets objectifs / stats */
  widgetLabel?: string
  widgetGoalCurrent?: number
  widgetGoalTarget?: number
  widgetUseLiveData?: boolean
  goalStyle?: GoalWidgetStyle
  /** Sondage */
  pollQuestion?: string
  pollOptions?: string[]
  pollVotes?: number[]
  pollStyle?: PollWidgetStyle
}

export interface Scene {
  id: string
  name: string
  sources: Source[]
}

export interface SceneCollection {
  id: string
  name: string
  scenes: Scene[]
  activeSceneId: string
}

export interface SceneCollectionsStore {
  collections: SceneCollection[]
  activeCollectionId: string
}

export type UserMode = 'twitch' | 'basic'

export interface TwitchCategory {
  id: string
  name: string
  boxArtUrl?: string
}

export interface TwitchChannelInfo {
  title: string
  categoryId: string
  categoryName: string
}

/** Paramètres widgets synchronisés depuis le site web Nova Stream. */
export interface WebWidgetSettings {
  alert?: {
    enabled?: boolean
    style?: AlertBoxStyle
    animation?: AlertAnimation
    durationSec?: number
    types?: Partial<Record<AlertType, boolean>>
    /** Jouer un son à chaque alerte (défaut : activé). */
    soundEnabled?: boolean
    /** Volume des sons d'alerte (0–100, défaut 80). */
    soundVolume?: number
    /** URL audio personnalisée par type (vide = son Nova Stream par défaut). */
    sounds?: Partial<Record<AlertType, string>>
  }
  chat?: {
    enabled?: boolean
    style?: ChatBoxStyle
    maxMessages?: number
  }
  followerGoal?: {
    enabled?: boolean
    style?: GoalWidgetStyle
    label?: string
    target?: number
    useLiveData?: boolean
  }
  subGoal?: {
    enabled?: boolean
    style?: GoalWidgetStyle
    label?: string
    target?: number
    useLiveData?: boolean
  }
  viewerCount?: {
    enabled?: boolean
    style?: GoalWidgetStyle
    label?: string
    useLiveData?: boolean
  }
  poll?: {
    enabled?: boolean
    style?: PollWidgetStyle
    question?: string
    options?: string[]
  }
  donations?: DonationSettings
}

/** Paramètres de la page de dons (synchronisés site ↔ app). */
export interface DonationSettings {
  enabled?: boolean
  currency?: 'EUR' | 'USD'
  minAmount?: number
  suggestedAmounts?: number[]
  pageTitle?: string
  pageMessage?: string
  thankYouMessage?: string
  /** Libellé affiché sur l'alerte live (ex. « Nouveau don »). */
  alertTitle?: string
  /** Message par défaut si le viewer n'en laisse pas un. */
  alertDefaultMessage?: string
  /** Modèle : {name}, {amount}, {message} */
  alertMessageTemplate?: string
  /** Clé secrète pour récupérer les dons dans l'app desktop. */
  donationKey?: string
  /** Nom PayPal.me (legacy — si PayPal OAuth non connecté). */
  paypalUsername?: string
  /** standard | business — choix du streamer à la connexion OAuth. */
  paypalAccountType?: 'standard' | 'business'
  /** Montant minimum pour qu'un donateur ajoute un GIF Giphy (défaut 25). */
  donationGifMinAmount?: number
  /** Désactiver les GIF donateurs sur les alertes. */
  donationGifEnabled?: boolean
}

export interface StreamSettings {
  rtmpUrl: string
  streamKey: string
  /** Titre du live Twitch (appliqué avant le démarrage). */
  streamTitle: string
  streamCategoryId: string
  streamCategoryName: string
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
  /** Décalage A/V en ms — utilisé seulement si audioSyncAuto est désactivé (ajustement fin ±500 ms). */
  audioSyncOffsetMs: number
  /** Synchro automatique par horloge commune (recommandé). */
  audioSyncAuto?: boolean
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

export interface StreamHealth {
  ffmpegRunning: boolean
  videoFlowing: boolean
  lastVideoChunkAgeMs: number
  videoChunksTotal: number
  twitchLive?: boolean
}

export interface DisplaySource {
  id: string
  name: string
  displayId: string
  thumbnail?: string
}

export type CapturePickerKind = 'screen' | 'window' | 'game'

export interface CaptureSourceOption {
  id: string
  name: string
  kind: 'screen' | 'window'
  thumbnail?: string
}

export interface CapturePickerOpenPayload {
  kind: CapturePickerKind
  mode: 'add' | 'recapture'
  sourceId?: string
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
  game: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 },
  browser: { x: 0, y: 0, width: 100, height: 100, zIndex: 2 },
  webcam: { x: 72, y: 68, width: 22, height: 22, zIndex: 10 },
  image: { x: 10, y: 10, width: 30, height: 30, zIndex: 5 },
  text: { x: 5, y: 85, width: 40, height: 10, zIndex: 15 },
  chat: { x: 1, y: 62, width: 28, height: 36, zIndex: 20 },
  alert: { x: 30, y: 8, width: 40, height: 18, zIndex: 25 },
  followerGoal: { x: 2, y: 2, width: 26, height: 12, zIndex: 22 },
  subGoal: { x: 2, y: 15, width: 26, height: 12, zIndex: 23 },
  viewerCount: { x: 72, y: 2, width: 14, height: 10, zIndex: 24 },
  poll: { x: 30, y: 30, width: 36, height: 28, zIndex: 21 }
}

export function createSource(type: SourceType, name?: string): Source {
  const labels: Record<SourceType, string> = {
    display: 'Capture écran',
    screen: 'Écran',
    window: 'Fenêtre',
    game: 'Capture de jeu',
    browser: 'Navigateur',
    webcam: 'Webcam',
    image: 'Image',
    text: 'Texte',
    chat: 'Chat Box',
    alert: 'Alert Box',
    followerGoal: 'Objectif followers',
    subGoal: 'Objectif abonnés',
    viewerCount: 'Spectateurs',
    poll: 'Sondage'
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
    scaleMode: type === 'webcam' ? 'fit' : 'stretch',
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    maskShape: type === 'webcam' ? 'rounded' : 'none',
    maskRadius: type === 'webcam' ? 18 : undefined,
    opacity: 100,
    chatStyle: type === 'chat' ? 'classic' : undefined,
    chatMaxMessages: type === 'chat' ? 6 : undefined,
    alertStyle: type === 'alert' ? 'classic' : undefined,
    alertAnimation: type === 'alert' ? 'pop' : undefined,
    widgetGoalTarget: type === 'followerGoal' ? 100 : type === 'subGoal' ? 50 : undefined,
    widgetGoalCurrent: type === 'followerGoal' || type === 'subGoal' || type === 'viewerCount' ? 0 : undefined,
    widgetUseLiveData: type === 'followerGoal' || type === 'subGoal' || type === 'viewerCount' ? true : undefined,
    widgetLabel:
      type === 'followerGoal' ? 'Objectif followers'
      : type === 'subGoal' ? 'Objectif abonnés'
      : type === 'viewerCount' ? 'Spectateurs'
      : undefined,
    goalStyle: type === 'followerGoal' || type === 'subGoal' || type === 'viewerCount' ? 'classic' : undefined,
    pollQuestion: type === 'poll' ? 'Quel est votre jeu préféré ?' : undefined,
    pollOptions: type === 'poll' ? ['RPG', 'FPS', 'Stratégie'] : undefined,
    pollVotes: type === 'poll' ? [12, 28, 9] : undefined,
    pollStyle: type === 'poll' ? 'bars' : undefined,
    textContent: type === 'text' ? 'Bienvenue sur le stream !' : undefined
  }
}

export const DEFAULT_STREAM_SETTINGS: StreamSettings = {
  rtmpUrl: 'rtmp://live.twitch.tv/app',
  streamKey: '',
  streamTitle: '',
  streamCategoryId: '',
  streamCategoryName: '',
  resolution: '1920x1080',
  framerate: 30,
  videoBitrate: 4500,
  audioBitrate: 160,
  encoder: 'x264',
  audioEnabled: true,
  audioDevice: '',
  audioGainDb: 0,
  micMono: false,
  desktopAudioGainDb: 0,
  desktopAudioEnabled: true,
  desktopAudioDevice: '',
  webcamDevice: '',
  recordingEnabled: false,
  recordAudioEnabled: true,
  recordingPath: '',
  transition: 'fade',
  transitionDuration: 300,
  audioSyncOffsetMs: 0,
  audioSyncAuto: true
}
