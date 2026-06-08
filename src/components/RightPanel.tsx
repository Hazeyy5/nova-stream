import type { Source, StreamSettings } from '../types'
import SourceProperties from './SourceProperties'
import AudioMixer from './AudioMixer'
import './RightPanel.css'

interface RightPanelProps {
  selectedSource: Source | null
  sources: Source[]
  settings: StreamSettings
  onUpdateSource: (id: string, partial: Partial<Source>) => void
  onUpdateSettings: (partial: Partial<StreamSettings>) => void
}

export default function RightPanel(props: RightPanelProps) {
  return (
    <aside className="right-panel">
      <div className="right-panel-section">
        <SourceProperties
          source={props.selectedSource}
          onUpdate={(partial) => {
            if (props.selectedSource) props.onUpdateSource(props.selectedSource.id, partial)
          }}
        />
      </div>
      <div className="right-panel-divider" />
      <div className="right-panel-section">
        <AudioMixer
          sources={props.sources}
          settings={props.settings}
          onUpdateSource={props.onUpdateSource}
          onUpdateSettings={props.onUpdateSettings}
        />
      </div>
    </aside>
  )
}
