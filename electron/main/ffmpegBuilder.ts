import { join } from 'path'
import type { StreamSettings } from '../../src/types'

export function buildRtmpUrl(settings: StreamSettings): string {
  const base = settings.rtmpUrl.replace(/\/$/, '')
  const key = settings.streamKey.trim()
  return key ? `${base}/${key}` : base
}

function ffmpegOutputPath(path: string): string {
  return path.replace(/\\/g, '/')
}

function dshowInput(device: string, kind: 'video' | 'audio'): string {
  return `${kind}=${device}`
}

export function buildFfmpegScenePipeArgs(
  settings: StreamSettings,
  options: { rtmpUrl?: string; recordPath?: string; includeAudio?: boolean } = {}
): string[] {
  const includeAudio = options.includeAudio !== false
  const args: string[] = [
    '-y',
    '-fflags', '+genpts',
    '-probesize', '32M',
    '-analyzeduration', '10M',
    '-f', 'webm',
    '-i', 'pipe:0'
  ]

  let inputIndex = 1
  const filters: string[] = []
  const audioInputIndices: number[] = []

  if (includeAudio && settings.audioEnabled && settings.audioDevice) {
    args.push('-f', 'dshow', '-i', dshowInput(settings.audioDevice, 'audio'))
    audioInputIndices.push(inputIndex++)
  }
  if (includeAudio && settings.desktopAudioEnabled && settings.desktopAudioDevice) {
    args.push('-f', 'dshow', '-i', dshowInput(settings.desktopAudioDevice, 'audio'))
    audioInputIndices.push(inputIndex++)
  }

  let audioOut: string | null = null
  if (audioInputIndices.length === 1) {
    const vol = settings.audioVolume / 100
    filters.push(`[${audioInputIndices[0]}:a]volume=${vol}[outa]`)
    audioOut = '[outa]'
  } else if (audioInputIndices.length > 1) {
    const vol = settings.audioVolume / 100
    filters.push(
      `[${audioInputIndices[0]}:a][${audioInputIndices[1]}:a]amix=inputs=2:duration=longest,volume=${vol}[outa]`
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
    '-r', String(settings.framerate)
  )

  if (audioOut) {
    args.push('-c:a', 'aac', '-b:a', `${settings.audioBitrate}k`, '-ar', '44100')
  } else {
    args.push('-an')
  }

  if (options.rtmpUrl && options.recordPath) {
    const recordPath = ffmpegOutputPath(options.recordPath)
    args.push('-f', 'tee', `[f=flv]${options.rtmpUrl}|[f=mp4]${recordPath}`)
  } else if (options.rtmpUrl) {
    args.push('-f', 'flv', options.rtmpUrl)
  } else if (options.recordPath) {
    args.push('-movflags', '+faststart', '-f', 'mp4', ffmpegOutputPath(options.recordPath))
  } else {
    throw new Error('Aucune sortie configurée')
  }

  return args
}

export function defaultRecordingPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return join(process.env.USERPROFILE ?? '.', 'Videos', 'NovaStream', `enregistrement-${timestamp}.mp4`)
}

export function parseFfmpegError(stderr: string): string {
  if (stderr.includes('Could not find video device')) {
    return 'Périphérique vidéo introuvable — vérifiez Paramètres → Vidéo, ou masquez la source CAM.'
  }
  if (stderr.includes('Could not find audio device')) {
    return 'Microphone introuvable — vérifiez Paramètres → Audio.'
  }
  if (stderr.includes('Error opening input')) {
    return 'Impossible d\'ouvrir une source de capture. Vérifiez vos périphériques dans Paramètres.'
  }
  const lines = stderr.trim().split('\n').filter((l) => l.trim())
  return lines[lines.length - 1] ?? 'Erreur FFmpeg'
}
