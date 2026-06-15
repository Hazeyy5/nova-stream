import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { FeedEvent } from '../../../src/types'

const MAX_EVENTS = 50
const FILE = () => join(app.getPath('userData'), 'activity-feed.json')

export function loadPersistedFeedEvents(): FeedEvent[] {
  try {
    const path = FILE()
    if (!existsSync(path)) return []
    const data = JSON.parse(readFileSync(path, 'utf-8')) as { events?: FeedEvent[] }
    const events = Array.isArray(data.events) ? data.events : []
    return events
      .filter((e) => e && typeof e.id === 'string' && typeof e.text === 'string')
      .slice(0, MAX_EVENTS)
  } catch {
    return []
  }
}

export function savePersistedFeedEvents(events: FeedEvent[]): void {
  const trimmed = events.slice(0, MAX_EVENTS)
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  writeFileSync(FILE(), JSON.stringify({ events: trimmed }, null, 2))
}
