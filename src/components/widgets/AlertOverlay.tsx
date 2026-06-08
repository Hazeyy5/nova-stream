import type { StreamAlert } from '../../types'
import './AlertOverlay.css'

interface AlertOverlayProps {
  alerts: StreamAlert[]
}

const ALERT_META: Record<StreamAlert['type'], { icon: string; label: string; color: string }> = {
  follow: { icon: '💜', label: 'Nouveau follower', color: '#9146FF' },
  sub: { icon: '⭐', label: 'Nouvel abonné', color: '#f1c40f' },
  donation: { icon: '💰', label: 'Don', color: '#2ecc71' },
  raid: { icon: '🚀', label: 'Raid', color: '#e74c3c' }
}

export default function AlertOverlay({ alerts }: AlertOverlayProps) {
  const alert = alerts[alerts.length - 1]
  if (!alert) {
    return (
      <div className="alert-overlay alert-idle">
        <span>🔔</span>
        <span>Alert Box</span>
      </div>
    )
  }

  const meta = ALERT_META[alert.type]

  return (
    <div className="alert-overlay alert-active" style={{ '--alert-color': meta.color } as React.CSSProperties}>
      <div className="alert-glow" />
      <span className="alert-icon">{meta.icon}</span>
      <div className="alert-content">
        <span className="alert-type">{meta.label}</span>
        <span className="alert-user">{alert.username}</span>
        {alert.message && <span className="alert-msg">{alert.message}</span>}
        {alert.amount && <span className="alert-amount">{alert.amount}</span>}
      </div>
    </div>
  )
}
