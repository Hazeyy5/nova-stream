import { IconLive, IconRecord } from './Icons'
import './Header.css'

interface HeaderProps {
  sceneName: string
  isLive: boolean
  isRecording: boolean
}

export default function Header({ sceneName, isLive, isRecording }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <span className="header-brand-name">Nova Stream</span>
      </div>

      <div className="header-center">
        <span className="header-scene-title">{sceneName}</span>
        {isLive && (
          <div className="status-badge live">
            <IconLive size={8} />
            En direct
          </div>
        )}
        {isRecording && !isLive && (
          <div className="status-badge record">
            <IconRecord size={8} />
            REC
          </div>
        )}
      </div>

      <div className="header-right">
        <span className="header-version">v0.6</span>
      </div>
    </header>
  )
}
