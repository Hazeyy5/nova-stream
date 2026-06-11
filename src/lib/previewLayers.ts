import type { Source } from '../types'

const MOTION_TYPES = new Set<Source['type']>(['screen', 'window', 'display', 'webcam', 'browser'])

export function sortVisibleLayers(sources: Source[]): Source[] {
  return sources
    .filter((s) => s.visible)
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)
}

export function sceneNeedsMotionFps(layers: Source[]): boolean {
  return layers.some((s) => MOTION_TYPES.has(s.type))
}

export function sceneHasActiveAlerts(alerts: { shownAt?: number }[]): boolean {
  return alerts.length > 0
}

export function resolvePreviewFps(
  layers: Source[],
  targetFps: number,
  captureActive: boolean,
  activeAlerts: { shownAt?: number }[] = []
): number {
  if (captureActive) return targetFps
  if (sceneHasActiveAlerts(activeAlerts)) return Math.min(targetFps, 30)
  if (layers.length === 0) return 10
  if (sceneNeedsMotionFps(layers)) return Math.min(targetFps, 30)
  return Math.min(targetFps, 24)
}
