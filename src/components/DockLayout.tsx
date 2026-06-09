import type { ReactNode } from 'react'
import './DockLayout.css'

interface DockLayoutProps {
  scenes: ReactNode
  sources: ReactNode
  mixer: ReactNode
  controls: ReactNode
}

export default function DockLayout({ scenes, sources, mixer, controls }: DockLayoutProps) {
  return (
    <div className="dock-layout">
      <div className="dock-col scenes-col">{scenes}</div>
      <div className="dock-col sources-col">{sources}</div>
      <div className="dock-col mixer-col">{mixer}</div>
      <div className="dock-col controls-col">{controls}</div>
    </div>
  )
}
