import type { SourceType } from '../types'

export const CANVAS_WIDGET_TYPES = new Set<SourceType>([
  'chat',
  'alert',
  'followerGoal',
  'subGoal',
  'viewerCount',
  'poll'
])

export function isCanvasWidget(type: SourceType): boolean {
  return CANVAS_WIDGET_TYPES.has(type)
}
