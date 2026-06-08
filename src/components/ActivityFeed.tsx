import type { FeedEvent } from '../types'
import './ActivityFeed.css'

interface ActivityFeedProps {
  events: FeedEvent[]
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'à l\'instant'
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  return `il y a ${Math.floor(s / 3600)} h`
}

const PLATFORM_COLORS: Record<string, string> = {
  twitch: '#9146FF',
  kick: '#53FC18',
  system: '#00d4b8'
}

export default function ActivityFeed({ events }: ActivityFeedProps) {
  const display = events.length > 0 ? events : [{
    id: 'welcome',
    type: 'system' as const,
    platform: 'system' as const,
    icon: '✨',
    text: 'Connectez Twitch ou Kick dans Apps pour voir le chat et les alertes ici',
    timestamp: Date.now()
  }]

  return (
    <div className="activity-feed">
      <div className="activity-feed-label">
        <span className="feed-pulse" />
        Mini flux
      </div>
      <div className="activity-feed-scroll">
        {display.map((evt) => (
          <div
            key={evt.id}
            className={`activity-item activity-${evt.type}`}
            style={{ '--evt-color': PLATFORM_COLORS[evt.platform] ?? '#888' } as React.CSSProperties}
          >
            <span className="activity-icon">{evt.icon}</span>
            <span className="activity-text">{evt.text}</span>
            <span className="activity-time">{timeAgo(evt.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
