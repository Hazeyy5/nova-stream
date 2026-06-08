import { useState } from 'react'
import type { Source, SourceType } from '../types'
import { IconCamera, IconDisplay, IconEye, IconImage, IconText, IconTrash } from './Icons'
import SourceInspector from './SourceInspector'
import './DockPanel.css'

interface SourcesDockProps {
  sources: Source[]
  selectedSourceId: string | null
  onSourceSelect: (id: string | null) => void
  onAddSource: (type: SourceType) => void
  onUpdateSource: (id: string, partial: Partial<Source>) => void
  onRemoveSource: (id: string) => void
  onMoveSource: (id: string, dir: 'up' | 'down') => void
  selectedSource: Source | null
}

const SOURCE_TYPES: { type: SourceType; label: string; Icon?: typeof IconDisplay; emoji?: string }[] = [
  { type: 'display', label: 'Capture de jeu', Icon: IconDisplay },
  { type: 'webcam', label: 'Webcam', Icon: IconCamera },
  { type: 'chat', label: 'Chat Box', emoji: '💬' },
  { type: 'alert', label: 'Alert Box', emoji: '🔔' },
  { type: 'image', label: 'Image', Icon: IconImage },
  { type: 'text', label: 'Texte', Icon: IconText }
]

export default function SourcesDock(props: SourcesDockProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="dock-panel dock-panel-wide">
      <div className="dock-panel-header">
        <h3>Sources</h3>
        <div className="dock-add-wrap">
          <button className="dock-add-btn" onClick={() => setShowMenu(!showMenu)} title="Ajouter une source">+</button>
          {showMenu && (
            <div className="dock-add-menu">
              {SOURCE_TYPES.map(({ type, label, Icon, emoji }) => (
                <button key={type} onClick={() => { props.onAddSource(type); setShowMenu(false) }}>
                  {emoji ? <span>{emoji}</span> : Icon && <Icon size={14} />}
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ul className="dock-list sources-dock-list">
        {props.sources.length === 0 && (
          <li className="dock-empty">Cliquez + pour ajouter une source</li>
        )}
        {[...props.sources].reverse().map((source, idx, arr) => (
          <li
            key={source.id}
            className={`${source.id === props.selectedSourceId ? 'selected' : ''} ${!source.visible ? 'dimmed' : ''}`}
          >
            <button className="dock-list-btn source-row" onClick={() => props.onSourceSelect(source.id)}>
              <SourceIcon type={source.type} />
              <span className="source-name">{source.name}</span>
            </button>
            <div className="source-row-actions">
              <button
                className="dock-item-action"
                onClick={() => props.onUpdateSource(source.id, { visible: !source.visible })}
                title={source.visible ? 'Masquer' : 'Afficher'}
              >
                <IconEye visible={source.visible} size={13} />
              </button>
              <button
                className="dock-item-action"
                onClick={() => props.onUpdateSource(source.id, { locked: !source.locked })}
                title={source.locked ? 'Déverrouiller' : 'Verrouiller'}
              >
                {source.locked ? '🔒' : '🔓'}
              </button>
              <button
                className="dock-item-action"
                onClick={() => props.onMoveSource(source.id, 'up')}
                disabled={idx === 0}
              >↑</button>
              <button
                className="dock-item-action"
                onClick={() => props.onMoveSource(source.id, 'down')}
                disabled={idx === arr.length - 1}
              >↓</button>
              <button
                className="dock-item-action danger"
                onClick={() => props.onRemoveSource(source.id)}
              >
                <IconTrash size={12} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {props.selectedSource && (
        <SourceInspector
          source={props.selectedSource}
          onUpdate={(partial) => props.onUpdateSource(props.selectedSource!.id, partial)}
          onClose={() => props.onSourceSelect(null)}
        />
      )}
    </div>
  )
}

function SourceIcon({ type }: { type: SourceType }) {
  const emojis: Partial<Record<SourceType, string>> = { chat: '💬', alert: '🔔' }
  if (emojis[type]) return <span className="source-icon-wrap">{emojis[type]}</span>
  const map = { display: IconDisplay, webcam: IconCamera, image: IconImage, text: IconText }
  const Icon = map[type as keyof typeof map]
  return Icon ? <span className="source-icon-wrap"><Icon size={13} /></span> : null
}
