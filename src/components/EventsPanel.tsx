import { memo, useEffect, useState } from 'react'
import type { FeedEvent } from '../types'
import { filterActivityEvents } from '../lib/feedEvents'
import './EventsPanel.css'

interface EventsPanelProps {
  events: FeedEvent[]
  onClear?: () => void
}

function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 60) return `il y a ${s}s`
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  return `il y a ${Math.floor(s / 3600)} h`
}

const PLATFORM_COLORS: Record<string, string> = {
  twitch: '#9146FF',
  kick: '#53FC18',
  system: '#c084fc'
}

const TYPE_ICONS: Partial<Record<FeedEvent['type'], string>> = {
  follow: '💜',
  sub: '⭐',
  alert: '🔔',
  system: '✨'
}

const EventRow = memo(function EventRow({ evt, now }: { evt: FeedEvent; now: number }) {
  const icon = evt.icon || TYPE_ICONS[evt.type] || '•'
  return (
    <div
      className={`events-panel-item events-${evt.type}`}
      style={{ '--evt-color': PLATFORM_COLORS[evt.platform] ?? '#888' } as React.CSSProperties}
    >
      <span className="events-panel-icon">{icon}</span>
      <div className="events-panel-body">
        <span className="events-panel-text">{evt.text}</span>
        <span className="events-panel-time">{timeAgo(evt.timestamp, now)}</span>
      </div>
    </div>
  )
})

export default function EventsPanel({ events, onClear }: EventsPanelProps) {
  const [now, setNow] = useState(Date.now())
  const activity = filterActivityEvents(events)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const display = activity.length > 0 ? activity : [{
    id: 'welcome',
    type: 'system' as const,
    platform: 'system' as const,
    icon: '✨',
    text: 'Follows, abonnements et dons apparaîtront ici',
    timestamp: Date.now()
  }]

  return (
    <div className="dock-panel events-panel">
      <div className="dock-panel-header">
        <h3>Événements</h3>
        {onClear && activity.length > 0 && (
          <button type="button" className="events-clear-btn" onClick={onClear} title="Effacer l'historique">
            Effacer
          </button>
        )}
      </div>
      <div className="events-panel-scroll">
        {display.map((evt) => (
          <EventRow key={evt.id} evt={evt} now={now} />
        ))}
      </div>
    </div>
  )
}
