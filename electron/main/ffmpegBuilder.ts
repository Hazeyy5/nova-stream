import { join } from 'path'
import type { SceneStreamConfig, Source, StreamSettings } from '../../src/types'

export function buildRtmpUrl(settings: StreamSettings): string {
  const base = settings.rtmpUrl.replace(/\/$/, '')
  const key = settings.streamKey.trim()
  return key ? `${base}/${key}` : base
}

export function buildFfmpegArgs(
  settings: StreamSettings,
  scene: SceneStreamConfig,
  options: { rtmpUrl?: string; recordPath?: string } = {}
): string[] {
  const visible = scene.sources
    .filter((s) => s.visible && (s.type === 'display' || s.type === 'webcam'))
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)

  const screen = visible.find((s) => s.type === 'display')
  const webcam = visible.find((s) => s.type === 'webcam')
  const [resW, resH] = settings.resolution.split('x').map(Number)

  if (!screen && !webcam) {
    throw new Error('Aucune source vidéo visible')
  }

  const args: string[] = ['-y']
  let inputIndex = 0
  const filters: string[] = []
  let videoOut = `${inputIndex}:v`

  if (screen) {
    args.push(
      '-f', 'gdigrab',
      '-framerate', String(settings.framerate),
      '-video_size', settings.resolution,
      '-i', 'desktop'
    )
    inputIndex++
  }

  if (webcam && screen) {
    const camW = Math.max(160, Math.round(resW * webcam.transform.width / 100))
    const camH = Math.max(90, Math.round(resH * webcam.transform.height / 100))
    args.push(
      '-f', 'dshow',
      '-video_size', `${camW}x${camH}`,
      '-framerate', String(settings.framerate),
      '-i', `video=${settings.webcamDevice || 'Integrated Camera'}`
    )
    const x = Math.round(resW * webcam.transform.x / 100)
    const y = Math.round(resH * webcam.transform.y / 100)
    filters.push(`[1:v]scale=${camW}:${camH}[cam]`)
    filters.push(`[0:v][cam]overlay=${x}:${y}:format=auto[outv]`)
    videoOut = '[outv]'
    inputIndex++
  } else if (webcam) {
    args.push(
      '-f', 'dshow',
      '-video_size', settings.resolution,
      '-framerate', String(settings.framerate),
      '-i', `video=${settings.webcamDevice || 'Integrated Camera'}`
    )
    inputIndex++
  }

  const audioInputIndices: number[] = []
  if (settings.audioEnabled && settings.audioDevice) {
    args.push('-f', 'dshow', '-i', `audio=${settings.audioDevice}`)
    audioInputIndices.push(inputIndex++)
  }
  if (settings.desktopAudioEnabled && settings.desktopAudioDevice) {
    args.push('-f', 'dshow', '-i', `audio=${settings.desktopAudioDevice}`)
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
    args.push('-map', videoOut)
    if (audioOut) args.push('-map', audioOut)
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
    '-g', String(settings.framerate * 2)
  )

  if (audioOut) {
    args.push('-c:a', 'aac', '-b:a', `${settings.audioBitrate}k`, '-ar', '44100')
  } else {
    args.push('-an')
  }

  if (options.rtmpUrl && options.recordPath) {
    args.push('-f', 'tee', `[f=flv]${options.rtmpUrl}|[f=mp4]${options.recordPath}`)
  } else if (options.rtmpUrl) {
    args.push('-f', 'flv', options.rtmpUrl)
  } else if (options.recordPath) {
    args.push('-f', 'mp4', options.recordPath)
  } else {
    throw new Error('Aucune sortie configurée')
  }

  return args
}

export function defaultRecordingPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return join(process.env.USERPROFILE ?? '.', 'Videos', 'NovaStream', `enregistrement-${timestamp}.mp4`)
}
