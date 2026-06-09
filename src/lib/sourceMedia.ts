import type { Source } from '../types'

export function isAcquirableMediaSource(source: Source): boolean {
  if (!source.visible) return false
  if (source.type === 'screen' || source.type === 'window') return !!source.captureId
  if (source.type === 'display' || source.type === 'webcam') return true
  if (source.type === 'image') return !!source.imageUrl
  if (source.type === 'browser') return !!source.browserUrl
  return false
}

export function mediaSourceKey(source: Source): string | null {
  if (!isAcquirableMediaSource(source)) return null
  return `${source.id}:${source.type}:${source.captureId ?? ''}:${source.browserUrl ?? ''}:${source.imageUrl ?? ''}`
}
