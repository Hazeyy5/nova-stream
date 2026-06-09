import type { FeedEvent } from '../types'

const ACTIVITY_TYPES = new Set<FeedEvent['type']>(['alert', 'system', 'follow', 'sub'])

export function isActivityEvent(event: FeedEvent): boolean {
  return ACTIVITY_TYPES.has(event.type)
}

export function filterActivityEvents(events: FeedEvent[]): FeedEvent[] {
  return events.filter(isActivityEvent)
}
