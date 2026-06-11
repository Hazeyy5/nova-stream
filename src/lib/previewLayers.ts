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

export function sceneNeedsWidgetFps(layers: Source[]): boolean {
  return layers.some((s) => s.type === 'chat' || s.type === 'alert')
}

export function resolvePreviewFps(
  layers: Source[],
  targetFps: number,
  captureActive: boolean
): number {
  if (captureActive) return targetFps
  if (sceneNeedsMotionFps(layers)) return Math.min(targetFps, 30)
  if (sceneNeedsWidgetFps(layers)) return 15
  return 8
}
