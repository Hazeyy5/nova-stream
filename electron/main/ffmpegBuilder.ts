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
}

export function buildRtmpUrl(settings: StreamSettings): string {
  const base = settings.rtmpUrl.replace(/\/$/, '')
  const key = settings.streamKey.trim()
  return key ? `${base}/${key}` : base
}

function ffmpegOutputPath(path: string): string {
  return path.replace(/\\/g, '/')
}

function teeEscapePath(path: string): string {
  return ffmpegOutputPath(path).replace(/'/g, "'\\''")
}

function buildTeeOutput(rtmpUrl: string, recordPath: string): string {
  const mp4Path = teeEscapePath(recordPath)
  return `[f=flv]${rtmpUrl}|[f=mp4:movflags=${RECORDING_MOVFLAGS}]'${mp4Path}'`
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

function dshowInput(device: string, kind: 'video' | 'audio'): string {
  return `${kind}=${device}`
}

function micProcessingFilter(micIndex: number, settings: StreamSettings, outputLabel: string): string {
  const micVol = resolveMicLinear(settings)
  let chain = `[${micIndex}:a]aresample=44100,aformat=sample_fmts=fltp`
  if (settings.micMono) {
    chain += `,pan=mono|c0=0.5*c0+0.5*c1`
  }
  chain += `,volume=${micVol.toFixed(4)}${outputLabel}`
  return chain
}

function desktopProcessingFilter(desktopIndex: number, deskVol: number, outputLabel: string): string {
  return `[${desktopIndex}:a]aresample=44100,aformat=sample_fmts=fltp,volume=${deskVol.toFixed(4)}${outputLabel}`
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
  const args: string[] = ['-y', '-fflags', '+genpts']

  if (copyVideo) {
    args.push('-f', 'h264', '-r', String(settings.framerate), '-i', 'pipe:0')
  } else {
    args.push('-probesize', '32M', '-analyzeduration', '10M', '-f', 'webm', '-i', 'pipe:0')
  }

  let inputIndex = 1
  const filters: string[] = []
  let usesNativeDesktop = false

  let micIndex: number | null = null
  let desktopIndex: number | null = null

  if (includeAudio && settings.audioEnabled && settings.audioDevice) {
    args.push('-f', 'dshow', '-i', dshowInput(settings.audioDevice, 'audio'))
    micIndex = inputIndex++
  }

  if (includeAudio && settings.desktopAudioEnabled) {
    const backend = settings.desktopAudioBackend ?? 'dshow'
    if (backend === 'native') {
      args.push(
        '-f', DESKTOP_AUDIO_PCM.format,
        '-ar', String(DESKTOP_AUDIO_PCM.sampleRate),
        '-ac', String(DESKTOP_AUDIO_PCM.channels),
        '-i', 'pipe:3'
      )
      desktopIndex = inputIndex++
      usesNativeDesktop = true
    } else {
      const desktopCapture = settings.desktopAudioCaptureDevice || settings.desktopAudioDevice
      if (desktopCapture) {
        args.push('-f', 'dshow', '-i', dshowInput(desktopCapture, 'audio'))
        desktopIndex = inputIndex++
      }
    }
  }

  let audioOut: string | null = null
  const deskVol = resolveDesktopLinear(settings)

  if (micIndex !== null && desktopIndex === null) {
    filters.push(
      micProcessingFilter(micIndex, settings, '[amix]'),
      masterAudioFilter('[amix]', '[outa]')
    )
    audioOut = '[outa]'
  } else if (desktopIndex !== null && micIndex === null) {
    filters.push(
      desktopProcessingFilter(desktopIndex, deskVol, '[amix]'),
      masterAudioFilter('[amix]', '[outa]')
    )
    audioOut = '[outa]'
  } else if (micIndex !== null && desktopIndex !== null) {
    filters.push(
      micProcessingFilter(micIndex, settings, '[a0]'),
      desktopProcessingFilter(desktopIndex, deskVol, '[a1]'),
      '[a0][a1]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[amix]',
      masterAudioFilter('[amix]', '[outa]')
    )
    audioOut = '[outa]'
  }

  if (filters.length > 0) {
    args.push('-filter_complex', filters.join(';'))
    args.push('-map', '0:v')
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
      '-g', String(settings.framerate * 2)
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
    args.push('-f', 'tee', buildTeeOutput(options.rtmpUrl, options.recordPath))
  } else if (options.rtmpUrl) {
    args.push('-f', 'flv', options.rtmpUrl)
  } else if (options.recordPath) {
    args.push('-movflags', RECORDING_MOVFLAGS, '-f', 'mp4', ffmpegOutputPath(options.recordPath))
  } else {
    throw new Error('Aucune sortie configurée')
  }

  return { args, usesNativeDesktop }
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
    return 'Impossible d\'ouvrir le microphone — vérifiez le périphérique dans Paramètres → Audio.'
  }
  if (stderr.includes('Error opening input')) {
    return 'Impossible d\'ouvrir une source de capture. Vérifiez vos périphériques dans Paramètres.'
  }
  const lines = stderr.trim().split('\n').filter((l) => l.trim())
  return lines[lines.length - 1] ?? 'Erreur FFmpeg'
}
