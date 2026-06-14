import { join } from 'path'
import { existsSync, statSync } from 'fs'
import { DESKTOP_AUDIO_PCM } from './desktopAudioCapture'
import type { StreamSettings } from '../../src/types'

const RECORDING_MOVFLAGS = 'frag_keyframe+empty_moov+default_base_moof'

const MIC_HEADROOM = 0.72
const DESKTOP_HEADROOM = 0.42
const MAX_LINEAR_GAIN = 3.5

function dbToLinear(db: number): number {
  if (db <= -60) return 0
  return Math.min(MAX_LINEAR_GAIN, Math.pow(10, db / 20))
}

function resolveMicLinear(settings: StreamSettings): number {
  const db = settings.audioGainDb ?? (settings.audioVolume != null ? 20 * Math.log10(Math.max(settings.audioVolume, 1) / 100) : 0)
  return dbToLinear(db) * MIC_HEADROOM
}

function resolveDesktopLinear(settings: StreamSettings): number {
  const db = settings.desktopAudioGainDb ?? (settings.desktopAudioVolume != null ? 20 * Math.log10(Math.max(settings.desktopAudioVolume, 1) / 100) : 0)
  return dbToLinear(db) * DESKTOP_HEADROOM
}

const MASTER_AUDIO_CHAIN =
  'acompressor=threshold=-18dB:ratio=3:attack=5:release=120:makeup=1,' +
  'alimiter=limit=0.82:attack=5:release=80:level=disabled'

export interface FfmpegBuildResult {
  args: string[]
  usesNativeDesktop: boolean
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

function resolveAudioSyncOffsetSec(settings: StreamSettings, videoInputFormat: 'h264' | 'webm'): number {
  let ms: number
  if (typeof settings.audioSyncOffsetMs === 'number' && Number.isFinite(settings.audioSyncOffsetMs)) {
    ms = settings.audioSyncOffsetMs
  } else {
    ms = videoInputFormat === 'h264' ? 120 : 280
  }
  return Math.max(-2, Math.min(2, ms / 1000))
}

function pushAudioInput(args: string[], offsetSec: number, inputArgs: string[]): void {
  if (Math.abs(offsetSec) > 0.001) {
    args.push('-itsoffset', offsetSec.toFixed(3))
  }
  args.push(...inputArgs)
}

function dshowInput(device: string, kind: 'video' | 'audio'): string {
  return `${kind}=${device}`
}

function micPreprocessFilter(micIndex: number, settings: StreamSettings, outputLabel: string): string {
  let chain = `[${micIndex}:a]asetpts=PTS-STARTPTS,aresample=44100:async=1:first_pts=0,aformat=sample_fmts=fltp`
  if (settings.micMono) {
    chain += `,pan=mono|c0=0.5*c0+0.5*c1`
  }
  return `${chain}${outputLabel}`
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
  } = {}
): FfmpegBuildResult {
  const includeAudio = options.includeAudio !== false
  const videoInputFormat = options.videoInputFormat ?? 'webm'
  const copyVideo = videoInputFormat === 'h264'
  const audioSyncOffsetSec = resolveAudioSyncOffsetSec(settings, videoInputFormat)
  const args: string[] = ['-y', '-fflags', '+genpts+nobuffer', '-max_interleave_delta', '0']

  if (copyVideo) {
    args.push(
      '-thread_queue_size', '512',
      '-f', 'h264',
      '-r', String(settings.framerate),
      '-i', 'pipe:0'
    )
  } else {
    args.push(
      '-thread_queue_size', '512',
      '-probesize', '500000',
      '-analyzeduration', '500000',
      '-fflags', '+nobuffer+flush_packets+genpts',
      '-flags', 'low_delay',
      '-f', 'webm',
      '-i', 'pipe:0'
    )
  }

  let inputIndex = 1
  const filters: string[] = []
  let usesNativeDesktop = false

  let micIndex: number | null = null
  let desktopIndex: number | null = null

  if (includeAudio && settings.audioEnabled && settings.audioDevice) {
    pushAudioInput(args, audioSyncOffsetSec, ['-f', 'dshow', '-i', dshowInput(settings.audioDevice, 'audio')])
    micIndex = inputIndex++
  }

  if (includeAudio && settings.desktopAudioEnabled) {
    const backend = settings.desktopAudioBackend ?? 'dshow'
    if (backend === 'native') {
      pushAudioInput(args, audioSyncOffsetSec, [
        '-f', DESKTOP_AUDIO_PCM.format,
        '-ar', String(DESKTOP_AUDIO_PCM.sampleRate),
        '-ac', String(DESKTOP_AUDIO_PCM.channels),
        '-i', 'pipe:3'
      ])
      desktopIndex = inputIndex++
      usesNativeDesktop = true
    } else {
      const desktopCapture = settings.desktopAudioCaptureDevice || settings.desktopAudioDevice
      if (desktopCapture) {
        pushAudioInput(args, audioSyncOffsetSec, ['-f', 'dshow', '-i', dshowInput(desktopCapture, 'audio')])
        desktopIndex = inputIndex++
      }
    }
  }

  let audioOut: string | null = null
  const deskVol = resolveDesktopLinear(settings)

  if (micIndex !== null && desktopIndex === null) {
    filters.push(
      micPreprocessFilter(micIndex, settings, '[micpre]'),
      volumeFilter('[micpre]', resolveMicLinear(settings), '[micpost]'),
      ...meterStatFilters('[micpost]', 'mic', '[amix]'),
      masterAudioFilter('[amix]', '[outa]')
    )
    audioOut = '[outa]'
  } else if (desktopIndex !== null && micIndex === null) {
    filters.push(
      `[${desktopIndex}:a]asetpts=PTS-STARTPTS,aresample=44100:async=1:first_pts=0,aformat=sample_fmts=fltp[deskpre]`,
      volumeFilter('[deskpre]', deskVol, '[deskpost]'),
      ...meterStatFilters('[deskpost]', 'desk', '[amix]'),
      masterAudioFilter('[amix]', '[outa]')
    )
    audioOut = '[outa]'
  } else if (micIndex !== null && desktopIndex !== null) {
    filters.push(
      micPreprocessFilter(micIndex, settings, '[micpre]'),
      volumeFilter('[micpre]', resolveMicLinear(settings), '[micpost]'),
      ...meterStatFilters('[micpost]', 'mic', '[a0]'),
      `[${desktopIndex}:a]asetpts=PTS-STARTPTS,aresample=44100:async=1:first_pts=0,aformat=sample_fmts=fltp[deskpre]`,
      volumeFilter('[deskpre]', deskVol, '[deskpost]'),
      ...meterStatFilters('[deskpost]', 'desk', '[a1]'),
      '[a0][a1]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[amix]',
      masterAudioFilter('[amix]', '[outa]')
    )
    audioOut = '[outa]'
  }

  if (filters.length > 0) {
    if (!copyVideo) {
      filters.unshift(`[0:v]setpts=PTS-STARTPTS[vout]`)
      args.push('-filter_complex', filters.join(';'))
      args.push('-map', '[vout]')
    } else {
      args.push('-filter_complex', filters.join(';'))
      args.push('-map', '0:v')
    }
    args.push('-map', audioOut!)
  } else {
    args.push('-map', '0:v')
  }

  const videoCodec = settings.encoder === 'nvenc' ? 'h264_nvenc' : 'libx264'
  if (copyVideo) {
    args.push('-c:v', 'copy')
  } else {
    args.push('-c:v', videoCodec)
    if (settings.encoder === 'x264') {
      args.push('-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p')
    } else {
      args.push('-preset', 'p4', '-pix_fmt', 'yuv420p')
    }
    args.push(
      '-b:v', `${settings.videoBitrate}k`,
      '-maxrate', `${settings.videoBitrate}k`,
      '-bufsize', `${settings.videoBitrate * 2}k`,
      '-g', String(settings.framerate * 2),
      '-vsync', 'cfr',
      '-r', String(settings.framerate)
    )
  }

  if (audioOut) {
    const monoMicOnly = settings.micMono && micIndex !== null && desktopIndex === null
    args.push('-c:a', 'aac', '-b:a', `${settings.audioBitrate}k`, '-ar', '44100')
    if (monoMicOnly) args.push('-ac', '1')
  } else {
    args.push('-an')
  }

  if (options.rtmpUrl && options.recordPath) {
    args.push('-muxdelay', '0', '-muxpreload', '0', '-f', 'tee', buildTeeOutput(options.rtmpUrl, options.recordPath))
  } else if (options.rtmpUrl) {
    args.push('-muxdelay', '0', '-muxpreload', '0', '-flvflags', 'no_duration_filesize', '-f', 'flv', options.rtmpUrl)
  } else if (options.recordPath) {
    args.push('-movflags', RECORDING_MOVFLAGS, '-f', 'mp4', ffmpegOutputPath(options.recordPath))
  } else {
    throw new Error('Aucune sortie configurée')
  }

  return {
    args,
    usesNativeDesktop,
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
  const lines = stderr.trim().split('\n').filter((l) => l.trim())
  return lines[lines.length - 1] ?? 'Erreur FFmpeg'
}
