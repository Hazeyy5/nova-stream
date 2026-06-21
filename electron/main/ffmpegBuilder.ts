import { join } from 'path'
import { existsSync, statSync } from 'fs'
import { DESKTOP_AUDIO_PCM } from './desktopAudioCapture'
import { MIC_AUDIO_PCM } from './micAudioCapture'
import { resolveStreamAudioTrimMs, buildAudioTrimSuffix, resolveVideoItsoffsetSec } from './streamPipelineSync'
import type { StreamSettings, VideoEncoder } from '../../src/types'

const FFMPEG_VIDEO_CODEC: Record<VideoEncoder, string> = {
  nvenc: 'h264_nvenc',
  amf: 'h264_amf',
  qsv: 'h264_qsv',
  x264: 'libx264'
}

function appendVideoEncoderArgs(args: string[], encoder: VideoEncoder): void {
  args.push('-c:v', FFMPEG_VIDEO_CODEC[encoder])
  switch (encoder) {
    case 'x264':
      args.push('-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p')
      break
    case 'nvenc':
      args.push('-preset', 'p4', '-pix_fmt', 'yuv420p')
      break
    case 'amf':
      args.push('-quality', 'speed', '-usage', 'transcoding', '-pix_fmt', 'yuv420p')
      break
    case 'qsv':
      args.push('-preset', 'veryfast', '-look_ahead', '0', '-pix_fmt', 'nv12')
      break
  }
}

const RECORDING_MOVFLAGS = 'frag_keyframe+empty_moov+default_base_moof'

const MIC_HEADROOM = 0.5
const DESKTOP_HEADROOM = 0.32
const MAX_LINEAR_GAIN = 2.5

function dbToLinear(db: number): number {
  if (db <= -60) return 0
  return Math.min(MAX_LINEAR_GAIN, Math.pow(10, db / 20))
}

function resolveMicLinear(settings: StreamSettings): number {
  if (!settings.audioEnabled) return 0
  const db = settings.audioGainDb ?? (settings.audioVolume != null ? 20 * Math.log10(Math.max(settings.audioVolume, 1) / 100) : 0)
  return dbToLinear(db) * MIC_HEADROOM
}

function resolveDesktopLinear(settings: StreamSettings): number {
  if (!settings.desktopAudioEnabled) return 0
  const db = settings.desktopAudioGainDb ?? (settings.desktopAudioVolume != null ? 20 * Math.log10(Math.max(settings.desktopAudioVolume, 1) / 100) : 0)
  return dbToLinear(db) * DESKTOP_HEADROOM
}

export function resolveStreamMicLinear(settings: StreamSettings): number {
  return resolveMicLinear(settings)
}

export function resolveStreamDesktopLinear(settings: StreamSettings): number {
  return resolveDesktopLinear(settings)
}

const MASTER_AUDIO_CHAIN = 'alimiter=limit=0.92:attack=8:release=120:level=disabled'

export interface FfmpegBuildResult {
  args: string[]
  usesNativeDesktop: boolean
  usesMicPipe: boolean
  micPipeFd: number | null
  desktopPipeFd: number | null
  meterChannels: { mic: boolean; desktop: boolean }
}

export function buildRtmpUrl(settings: StreamSettings): string {
  const base = settings.rtmpUrl.trim().replace(/\/+$/, '')
  const key = settings.streamKey.trim()
  if (!key) return base
  if (base.endsWith(`/${key}`) || base.endsWith(key)) return base
  return `${base}/${key}`
}

export function isAudioStartupError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('microphone') ||
    lower.includes('audio') ||
    lower.includes('capture') ||
    lower.includes('périphérique') ||
    lower.includes('peripherique') ||
    lower.includes('dshow') ||
    lower.includes('directshow')
  )
}

function ffmpegOutputPath(path: string): string {
  return path.replace(/\\/g, '/')
}

function teeEscapePath(path: string): string {
  return ffmpegOutputPath(path).replace(/'/g, "'\\''")
}

function buildTeeOutput(rtmpUrl: string, recordPath: string): string {
  const mp4Path = teeEscapePath(recordPath)
  return `[f=flv:flvflags=no_duration_filesize]${rtmpUrl}|[f=mp4:movflags=${RECORDING_MOVFLAGS}]'${mp4Path}'`
}

function recordingTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

/** Dossier configuré → fichier horodaté ; chemin vide → ~/Videos/NovaStream */
export function resolveRecordingFilePath(recordingPath = ''): string {
  const base = recordingPath.trim()
  const fileName = `enregistrement-${recordingTimestamp()}.mp4`

  if (!base) {
    return join(process.env.USERPROFILE ?? '.', 'Videos', 'NovaStream', fileName)
  }

  if (base.toLowerCase().endsWith('.mp4')) {
    return base
  }

  if (existsSync(base) && !statSync(base).isDirectory()) {
    return base
  }

  return join(base, fileName)
}

function pushAudioInput(args: string[], inputArgs: string[]): void {
  args.push(...inputArgs)
}

function dshowInput(device: string, kind: 'video' | 'audio'): string {
  return `${kind}=${device}`
}

function micPreprocessFilter(
  micIndex: number,
  settings: StreamSettings,
  outputLabel: string,
  videoInputFormat: 'h264' | 'webm'
): string {
  const channels = settings.micMono ? 1 : 2
  let chain = `[${micIndex}:a]asetpts=PTS-STARTPTS,aresample=44100:async=1:min_hard_comp=0.01:first_pts=0,aformat=sample_fmts=fltp`
  if (settings.micMono) {
    chain += `,pan=mono|c0=0.5*c0+0.5*c1`
  }
  chain += buildAudioTrimSuffix(resolveStreamAudioTrimMs(settings, videoInputFormat), channels)
  return `${chain}${outputLabel}`
}

function desktopPreprocessFilter(
  desktopIndex: number,
  settings: StreamSettings,
  outputLabel: string,
  videoInputFormat: 'h264' | 'webm'
): string {
  const chain = `[${desktopIndex}:a]asetpts=PTS-STARTPTS,aresample=44100:async=1:min_hard_comp=0.01:first_pts=0,aformat=sample_fmts=fltp`
  return `${chain}${buildAudioTrimSuffix(resolveStreamAudioTrimMs(settings, videoInputFormat), 2)}${outputLabel}`
}

function volumeFilter(inputLabel: string, linear: number, outputLabel: string): string {
  return `${inputLabel}volume=${linear.toFixed(4)}${outputLabel}`
}

function meterStatFilters(inputLabel: string, tag: 'mic' | 'desk', outputLabel: string): string[] {
  const statLabel = `[${tag}stat]`
  return [
    `${inputLabel}asplit=2${outputLabel}${statLabel}`,
    `${statLabel}astats=metadata=1:reset=0.35,ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-,anullsink`
  ]
}

function micProcessingChain(
  micIndex: number,
  settings: StreamSettings,
  linear: number,
  outputLabel: string,
  enableMeters: boolean,
  videoInputFormat: 'h264' | 'webm'
): string[] {
  const filters = [
    micPreprocessFilter(micIndex, settings, '[micpre]', videoInputFormat),
    volumeFilter('[micpre]', linear, '[micpost]')
  ]
  if (enableMeters) {
    filters.push(...meterStatFilters('[micpost]', 'mic', outputLabel))
  } else {
    filters.push(`[micpost]anull${outputLabel}`)
  }
  return filters
}

function desktopProcessingChain(
  desktopIndex: number,
  settings: StreamSettings,
  linear: number,
  outputLabel: string,
  enableMeters: boolean,
  videoInputFormat: 'h264' | 'webm'
): string[] {
  const filters = [
    desktopPreprocessFilter(desktopIndex, settings, '[deskpre]', videoInputFormat),
    volumeFilter('[deskpre]', linear, '[deskpost]')
  ]
  if (enableMeters) {
    filters.push(...meterStatFilters('[deskpost]', 'desk', outputLabel))
  } else {
    filters.push(`[deskpost]anull${outputLabel}`)
  }
  return filters
}

function masterAudioFilter(inputLabel: string, outputLabel: string): string {
  return `${inputLabel}${MASTER_AUDIO_CHAIN}${outputLabel}`
}

export function buildFfmpegScenePipeArgs(
  settings: StreamSettings,
  options: {
    rtmpUrl?: string
    recordPath?: string
    includeAudio?: boolean
    videoInputFormat?: 'h264' | 'webm'
    micViaPipe?: boolean
    mixViaNode?: boolean
  } = {}
): FfmpegBuildResult {
  const includeAudio = options.includeAudio !== false
  const videoInputFormat = options.videoInputFormat ?? 'webm'
  const micViaPipe = options.micViaPipe === true
  const mixViaNode = options.mixViaNode === true
  const copyVideo = videoInputFormat === 'h264'
  const isStreaming = !!options.rtmpUrl
  const enableMeters = includeAudio && !isStreaming
  const args: string[] = ['-y', '-loglevel', 'warning', '-stats', '-fflags', '+genpts+igndts']

  const syncOptions = { micViaPipe }
  const videoOffsetSec = resolveVideoItsoffsetSec(settings, videoInputFormat, syncOptions)
  if (videoOffsetSec > 0.001) {
    args.push('-itsoffset', videoOffsetSec.toFixed(3))
  }

  if (copyVideo) {
    args.push(
      '-thread_queue_size', '512',
      '-f', 'h264',
      '-r', String(settings.framerate),
      '-i', 'pipe:0'
    )
  } else {
    args.push(
      '-thread_queue_size', '256',
      '-probesize', '32768',
      '-analyzeduration', '100000',
      '-fflags', '+genpts+igndts+discardcorrupt+nobuffer',
      '-flags', 'low_delay',
      '-f', 'webm',
      '-i', 'pipe:0'
    )
  }

  let inputIndex = 1
  const filters: string[] = []
  let usesNativeDesktop = false
  let usesMicPipe = false
  let micPipeFd: number | null = null
  let desktopPipeFd: number | null = null
  let nextPipeFd = 3

  let micIndex: number | null = null
  let desktopIndex: number | null = null

  if (includeAudio && settings.audioDevice) {
    if (micViaPipe) {
      micPipeFd = nextPipeFd++
      usesMicPipe = true
      pushAudioInput(args, [
        '-thread_queue_size', '512',
        '-fflags', 'nobuffer',
        '-f', MIC_AUDIO_PCM.format,
        '-ar', String(MIC_AUDIO_PCM.sampleRate),
        '-ac', String(MIC_AUDIO_PCM.channels),
        '-i', `pipe:${micPipeFd}`
      ])
      micIndex = inputIndex++
    } else {
      pushAudioInput(args, ['-f', 'dshow', '-i', dshowInput(settings.audioDevice, 'audio')])
      micIndex = inputIndex++
    }
  }

  if (includeAudio && settings.desktopAudioEnabled) {
    const backend = settings.desktopAudioBackend ?? 'dshow'
    if (backend === 'native') {
      desktopPipeFd = nextPipeFd++
      pushAudioInput(args, [
        '-thread_queue_size', '512',
        '-fflags', 'nobuffer',
        '-f', DESKTOP_AUDIO_PCM.format,
        '-ar', String(DESKTOP_AUDIO_PCM.sampleRate),
        '-ac', String(DESKTOP_AUDIO_PCM.channels),
        '-i', `pipe:${desktopPipeFd}`
      ])
      desktopIndex = inputIndex++
      usesNativeDesktop = true
    } else {
      const desktopCapture = settings.desktopAudioCaptureDevice || settings.desktopAudioDevice
      if (desktopCapture) {
        pushAudioInput(args, ['-f', 'dshow', '-i', dshowInput(desktopCapture, 'audio')])
        desktopIndex = inputIndex++
      }
    }
  }

  let audioOut: string | null = null
  const deskVol = mixViaNode || usesNativeDesktop ? 1 : resolveDesktopLinear(settings)
  const micVol = mixViaNode || micViaPipe ? 1 : resolveMicLinear(settings)

  if (micIndex !== null && desktopIndex === null) {
    filters.push(
      ...micProcessingChain(micIndex, settings, micVol, '[amix]', enableMeters, videoInputFormat),
      masterAudioFilter('[amix]', '[outa]')
    )
    audioOut = '[outa]'
  } else if (desktopIndex !== null && micIndex === null) {
    filters.push(
      ...desktopProcessingChain(desktopIndex, settings, deskVol, '[amix]', enableMeters, videoInputFormat),
      masterAudioFilter('[amix]', '[outa]')
    )
    audioOut = '[outa]'
  } else if (micIndex !== null && desktopIndex !== null) {
    filters.push(
      ...micProcessingChain(micIndex, settings, micVol, '[a0]', enableMeters, videoInputFormat),
      ...desktopProcessingChain(desktopIndex, settings, deskVol, '[a1]', enableMeters, videoInputFormat),
      '[a0][a1]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[amixpre];[amixpre]volume=0.88[amix]',
      masterAudioFilter('[amix]', '[outa]')
    )
    audioOut = '[outa]'
  }

  if (filters.length > 0) {
    args.push('-filter_complex', filters.join(';'))
    args.push('-map', '0:v')
    args.push('-map', audioOut!)
    args.push('-max_muxing_queue_size', '9999')
  } else {
    args.push('-map', '0:v')
  }

  if (copyVideo) {
    args.push('-c:v', 'copy')
  } else {
    const encoder = settings.encoder in FFMPEG_VIDEO_CODEC ? settings.encoder : 'x264'
    appendVideoEncoderArgs(args, encoder)
    args.push(
      '-b:v', `${settings.videoBitrate}k`,
      '-maxrate', `${settings.videoBitrate}k`,
      '-bufsize', `${settings.videoBitrate * 2}k`,
      '-g', String(settings.framerate * 2),
      '-fps_mode', 'passthrough',
      '-r', String(settings.framerate)
    )
  }

  if (audioOut) {
    const monoMicOnly = settings.micMono && micIndex !== null && desktopIndex === null
    args.push('-c:a', 'aac', '-b:a', `${settings.audioBitrate}k`, '-ar', '44100', '-async', '1')
    if (monoMicOnly) args.push('-ac', '1')
  } else {
    args.push('-an')
  }

  if (options.rtmpUrl && options.recordPath) {
    args.push('-muxdelay', '0', '-muxpreload', '0', '-f', 'tee', buildTeeOutput(options.rtmpUrl, options.recordPath))
  } else if (options.rtmpUrl) {
    args.push(
      '-muxdelay', '0',
      '-muxpreload', '0',
      '-max_interleave_delta', '2000000',
      '-flush_packets', '1',
      '-flvflags', 'no_duration_filesize',
      '-f', 'flv',
      options.rtmpUrl
    )
  } else if (options.recordPath) {
    args.push('-movflags', RECORDING_MOVFLAGS, '-f', 'mp4', ffmpegOutputPath(options.recordPath))
  } else {
    throw new Error('Aucune sortie configurée')
  }

  return {
    args,
    usesNativeDesktop,
    usesMicPipe,
    micPipeFd,
    desktopPipeFd,
    meterChannels: {
      mic: micIndex !== null,
      desktop: desktopIndex !== null
    }
  }
}

export function defaultRecordingPath(): string {
  return resolveRecordingFilePath()
}

export function parseFfmpegError(stderr: string): string {
  if (stderr.includes('Could not find audio device') || stderr.includes('Could not find audio only device')) {
    return 'Microphone introuvable — vérifiez Paramètres → Audio et choisissez un micro DirectShow.'
  }
  if (stderr.includes('Could not find video device')) {
    return 'Périphérique vidéo introuvable — vérifiez Paramètres → Vidéo, ou masquez la source CAM.'
  }
  if (stderr.includes('acompressor') && stderr.includes('makeup')) {
    return 'Filtre audio incompatible — mettez à jour Nova Stream.'
  }
  if (stderr.includes('Result too large') && stderr.includes('filter_complex')) {
    return 'Chaîne de filtres audio invalide — vérifiez les périphériques audio dans Paramètres.'
  }
  if (stderr.includes('Error opening input file audio=')) {
    const match = stderr.match(/Error opening input file audio=([^\n]+)/)
    const device = match?.[1]?.trim()
    return device
      ? `Impossible d'ouvrir le périphérique audio « ${device} » — vérifiez Paramètres → Audio.`
      : 'Impossible d\'ouvrir le microphone — vérifiez le périphérique dans Paramètres → Audio.'
  }
  if (stderr.includes('Error opening input')) {
    return 'Impossible d\'ouvrir une source audio de capture — vérifiez micro et son du bureau dans Paramètres → Audio.'
  }
  if (stderr.includes('Connection refused') || (stderr.includes('I/O error') && stderr.includes('rtmp'))) {
    return 'Connexion RTMP refusée — vérifiez l\'URL et la clé de stream Twitch dans Paramètres.'
  }
  if (stderr.includes('Error opening output') || stderr.includes('authfailed') || stderr.includes('authentication failed')) {
    return 'Connexion Twitch refusée — vérifiez votre clé de stream dans Paramètres.'
  }
  if (stderr.includes('Invalid stream key') || stderr.includes('403')) {
    return 'Clé de stream Twitch invalide — régénérez-la sur le tableau de bord Twitch.'
  }
  if (stderr.includes('Cannot open connection') || stderr.includes('Connection to tcp://')) {
    return 'Impossible de joindre les serveurs Twitch — vérifiez votre connexion internet.'
  }
  const lines = stderr.trim().split('\n').filter((l) => l.trim())
  return lines[lines.length - 1] ?? 'Erreur FFmpeg'
}
