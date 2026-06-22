import { useEffect, useState } from 'react'
import { IconLive, IconRecord } from './Icons'
import logoUrl from '../assets/logo.png'
import './Header.css'

interface HeaderProps {
  sceneName: string
  isLive: boolean
  isRecording: boolean
}

export default function Header({ sceneName, isLive, isRecording }: HeaderProps) {
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    void window.novaStream.platform.getConfig().then((config) => setAppVersion(config.version))
  }, [])

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-brand" title="Nova Stream">
          <img src={logoUrl} alt="" className="header-brand-logo" width={28} height={28} draggable={false} />
          <div className="header-brand-text">
            <span className="header-brand-nova">Nova</span>
            <span className="header-brand-stream">Stream</span>
          </div>
        </div>
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
        <span className="header-version">{appVersion ? `v${appVersion}` : '…'}</span>
      </div>
    </header>
  )
}
