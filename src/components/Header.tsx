import { IconLive, IconRecord, IconSettings } from './Icons'
import './Header.css'

interface HeaderProps {
  isLive: boolean
  isRecording: boolean
  onSettingsClick: () => void
}

export default function Header({ isLive, isRecording, onSettingsClick }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
          </svg>
        </div>
        <div className="header-brand">
          <span className="header-title">Nova Stream</span>
          <span className="header-version">v0.2</span>
        </div>
      </div>

      <div className="header-status">
        {isLive && (
          <div className="status-badge live">
            <IconLive size={8} />
            EN DIRECT
          </div>
        )}
        {isRecording && (
          <div className="status-badge record">
            <IconRecord size={8} />
            REC
          </div>
        )}
      </div>

      <div className="header-right">
        <button className="header-settings-btn" onClick={onSettingsClick}>
          <IconSettings />
          <span>Paramètres</span>
        </button>
      </div>
    </header>
  )
}
