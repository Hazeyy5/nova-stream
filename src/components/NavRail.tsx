import { IconSettings } from './Icons'
import type { AppView } from '../types'
import logoUrl from '../assets/logo.png'
import './NavRail.css'

interface NavRailProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
  onSettingsClick: () => void
  hasConnection: boolean
  bitrate: number
}

const NAV_ITEMS: { id: AppView | 'settings'; view?: AppView; label: string; icon: string }[] = [
  { id: 'editor', view: 'editor', label: 'Studio', icon: '▦' },
  { id: 'integrations', view: 'integrations', label: 'Apps', icon: '⬡' }
]

export default function NavRail({
  activeView,
  onViewChange,
  onSettingsClick,
  hasConnection,
  bitrate
}: NavRailProps) {
  return (
    <nav className="nav-rail">
      <div className="nav-rail-logo" title="Nova Stream">
        <img src={logoUrl} alt="" width={44} height={44} draggable={false} />
      </div>

      <div className="nav-rail-items">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${item.view && activeView === item.view ? 'active' : ''}`}
            onClick={() => item.view && onViewChange(item.view)}
            title={item.label}
          >
            <span className="nav-item-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.id === 'integrations' && hasConnection && <span className="nav-badge" />}
          </button>
        ))}

      </div>

      <div className="nav-rail-status">
        <div className="nav-status-card">
          <span className="nav-status-label">{hasConnection ? 'Excellent' : 'Hors ligne'}</span>
          <span className="nav-status-value">{bitrate.toLocaleString('fr-FR')} kb/s</span>
        </div>
      </div>

      <div className="nav-rail-bottom">
        <button className="nav-item" onClick={onSettingsClick} title="Paramètres">
          <IconSettings size={18} />
          <span>Paramètres</span>
        </button>
      </div>
    </nav>
  )
}
