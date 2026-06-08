import type { ReactNode } from 'react'
import './DockLayout.css'

interface DockLayoutProps {
  scenes: ReactNode
  sources: ReactNode
  mixer: ReactNode
}

export default function DockLayout({ scenes, sources, mixer }: DockLayoutProps) {
  return (
    <div className="dock-layout">
      <div className="dock-col scenes-col">{scenes}</div>
      <div className="dock-col sources-col">{sources}</div>
      <div className="dock-col mixer-col">{mixer}</div>
    </div>
  )
}
