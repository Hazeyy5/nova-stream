import type { FeedEvent } from '../types'

export const MAX_FEED_EVENTS = 10

const ACTIVITY_TYPES = new Set<FeedEvent['type']>(['alert', 'system', 'follow', 'sub'])

export function isActivityEvent(event: FeedEvent): boolean {
  return ACTIVITY_TYPES.has(event.type)
}

export function filterActivityEvents(events: FeedEvent[]): FeedEvent[] {
  return events
    .filter(isActivityEvent)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_FEED_EVENTS)
}
