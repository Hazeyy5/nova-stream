import { useEffect, useState } from 'react'
import type { StreamSettings } from '../types'
import './StatusBar.css'

interface StatusBarProps {
  settings: StreamSettings
  fps?: number
}

export default function StatusBar({ settings, fps = 0 }: StatusBarProps) {
  const [ram, setRam] = useState(0)

  useEffect(() => {
    const update = () => {
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
      if (mem) setRam((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100)
    }
    update()
    const id = setInterval(update, 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        <span className="status-stat"><strong>RAM</strong> {ram.toFixed(1)}%</span>
        <span className="status-stat muted">Aperçu {Math.min(settings.framerate, 30)} fps max</span>
      </div>
      <div className="status-bar-center">
        <span className="status-wave" />
      </div>
      <div className="status-bar-right">
        <span className="status-stat">{fps > 0 ? fps.toFixed(0) : '—'} FPS</span>
        <span className="status-stat muted">{settings.resolution} · {settings.videoBitrate}k</span>
      </div>
    </footer>
  )
}
