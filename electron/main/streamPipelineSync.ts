import type { StreamSettings } from '../../src/types'

/**
 * Décalage vidéo (itsoffset) — comme OBS : la vidéo navigateur/encodeur
 * arrive plus tard que le micro DirectShow ; on retarde la vidéo pour aligner les lèvres.
 */
const AUTO_VIDEO_OFFSET_H264_SEC = 0.11
const AUTO_VIDEO_OFFSET_WEBM_SEC = 0.21

/** Ajustement manuel optionnel (±500 ms). */
export function resolveManualAudioTrimMs(settings: StreamSettings): number {
  if (typeof settings.audioSyncOffsetMs !== 'number' || !Number.isFinite(settings.audioSyncOffsetMs)) {
    return 0
  }
  return Math.max(-500, Math.min(500, settings.audioSyncOffsetMs))
}

export function resolveVideoItsoffsetSec(
  settings: StreamSettings,
  videoInputFormat: 'h264' | 'webm' = 'webm'
): number {
  const base = videoInputFormat === 'h264' ? AUTO_VIDEO_OFFSET_H264_SEC : AUTO_VIDEO_OFFSET_WEBM_SEC
  if (settings.audioSyncAuto === false) {
    const manualMs = resolveManualAudioTrimMs(settings)
    if (manualMs < 0) {
      // Son en retard → retarder davantage la vidéo
      return base + -manualMs / 1000
    }
    if (manualMs > 0) {
      // Son en avance → moins de retard vidéo
      return Math.max(0, base - manualMs / 1000)
    }
  }
  return base
}

/**
 * Décalage audio FFmpeg (adelay) — seulement si son en avance en mode manuel.
 * Le mode auto s'appuie sur itsoffset vidéo.
 */
export function resolveStreamAudioTrimMs(
  settings: StreamSettings,
  _videoInputFormat: 'h264' | 'webm' = 'webm'
): number {
  if (settings.audioSyncAuto === false) {
    const manualMs = resolveManualAudioTrimMs(settings)
    if (manualMs > 5) return manualMs
  }
  return 0
}

export function buildAudioTrimSuffix(trimMs: number, channels: number): string {
  if (trimMs > 5) {
    const perChannel = Array.from({ length: channels }, () => Math.round(trimMs)).join('|')
    return `,adelay=${perChannel}`
  }
  if (trimMs < -5) {
    const startSec = (-trimMs / 1000).toFixed(3)
    return `,atrim=start=${startSec},asetpts=PTS-STARTPTS`
  }
  return ''
}
