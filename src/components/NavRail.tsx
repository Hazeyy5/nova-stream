import { IconSettings } from './Icons'
import type { AppView } from '../types'
import './NavRail.css'

interface NavRailProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
  onSettingsClick: () => void
  hasConnection: boolean
}

export default function NavRail({ activeView, onViewChange, onSettingsClick, hasConnection }: NavRailProps) {
  return (
    <nav className="nav-rail">
      <div className="nav-rail-logo" title="Nova Stream">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
        </svg>
      </div>

      <div className="nav-rail-items">
        <button
          className={`nav-item ${activeView === 'editor' ? 'active' : ''}`}
          onClick={() => onViewChange('editor')}
          title="Éditeur"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <span>Éditeur</span>
        </button>

        <button
          className={`nav-item ${activeView === 'integrations' ? 'active' : ''}`}
          onClick={() => onViewChange('integrations')}
          title="Connexions Twitch / Kick"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span>Apps</span>
          {hasConnection && <span className="nav-badge" />}
        </button>
      </div>

      <div className="nav-rail-bottom">
        <button className="nav-item" onClick={onSettingsClick} title="Paramètres">
          <IconSettings size={20} />
          <span>Paramètres</span>
        </button>
      </div>
    </nav>
  )
}
