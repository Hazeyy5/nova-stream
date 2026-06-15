import type { Source } from '../types'

/** Source configurée pour capturer du média (indépendamment de la visibilité). */
export function isMediaCapableSource(source: Source): boolean {
  if (source.type === 'screen' || source.type === 'window' || source.type === 'game') return !!source.captureId
  if (source.type === 'display' || source.type === 'webcam') return true
  if (source.type === 'image') return !!(source.imageUrl || source.imageLocalPath)
  if (source.type === 'browser') return !!source.browserUrl
  return false
}

export function isAcquirableMediaSource(source: Source): boolean {
  if (!source.visible) return false
  return isMediaCapableSource(source)
}

export function mediaCaptureFingerprint(source: Source): string | null {
  if (!isMediaCapableSource(source)) return null
  return `${source.type}:${source.captureId ?? ''}:${source.browserUrl ?? ''}:${source.imageUrl ?? ''}:${source.imageLocalPath ?? ''}:${source.webcamDevice ?? ''}`
}

export function mediaSourceKey(source: Source): string | null {
  const fp = mediaCaptureFingerprint(source)
  if (!fp) return null
  return `${source.id}:${fp}`
}
