import { useState, useRef, useEffect } from 'react'
import type { Scene, Source, SourceType } from '../types'
import { IconCamera, IconDisplay, IconEye, IconImage, IconText, IconTrash } from './Icons'
import './LeftPanel.css'

interface LeftPanelProps {
  scenes: Scene[]
  activeSceneId: string
  onSceneSelect: (id: string) => void
  onAddScene: () => void
  onRemoveScene: (id: string) => void
  onRenameScene: (id: string, name: string) => void
  sources: Source[]
  selectedSourceId: string | null
  onSourceSelect: (id: string) => void
  onAddSource: (type: SourceType) => void
  onUpdateSource: (id: string, partial: Partial<Source>) => void
  onRemoveSource: (id: string) => void
  onMoveSource: (id: string, dir: 'up' | 'down') => void
}

const SOURCE_TYPES: { type: SourceType; label: string; Icon?: typeof IconDisplay; emoji?: string }[] = [
  { type: 'game', label: 'Capture de jeu', emoji: '🎮' },
  { type: 'screen', label: 'Écran', Icon: IconDisplay },
  { type: 'window', label: 'Fenêtre', emoji: '🪟' },
  { type: 'browser', label: 'Navigateur', emoji: '🌐' },
  { type: 'display', label: 'Sélecteur système', Icon: IconDisplay },
  { type: 'webcam', label: 'Webcam', Icon: IconCamera },
  { type: 'image', label: 'Image', Icon: IconImage },
  { type: 'text', label: 'Texte', Icon: IconText }
]

export default function LeftPanel(props: LeftPanelProps) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingSceneId) editRef.current?.focus()
  }, [editingSceneId])

  return (
    <aside className="left-panel">
      <section className="panel-block">
        <div className="panel-block-header">
          <h3>Scènes</h3>
          <button className="panel-icon-btn" onClick={props.onAddScene} title="Nouvelle scène">+</button>
        </div>
        <ul className="panel-list scenes-list">
          {props.scenes.map((scene) => (
            <li key={scene.id} className={scene.id === props.activeSceneId ? 'active' : ''}>
              {editingSceneId === scene.id ? (
                <input
                  ref={editRef}
                  className="scene-rename-input"
                  defaultValue={scene.name}
                  onBlur={(e) => {
                    props.onRenameScene(scene.id, e.target.value || scene.name)
                    setEditingSceneId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditingSceneId(null)
                  }}
                />
              ) : (
                <button
                  className="panel-list-item"
                  onClick={() => props.onSceneSelect(scene.id)}
                  onDoubleClick={() => setEditingSceneId(scene.id)}
                >
                  <span className="scene-dot" />
                  {scene.name}
                </button>
              )}
              {props.scenes.length > 1 && (
                <button
                  className="panel-item-action"
                  onClick={() => props.onRemoveScene(scene.id)}
                  title="Supprimer"
                >
                  <IconTrash />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-block panel-block-grow">
        <div className="panel-block-header">
          <h3>Sources</h3>
          <div className="add-source-wrap">
            <button
              className="panel-icon-btn"
              onClick={() => setShowAddMenu(!showAddMenu)}
              title="Ajouter une source"
            >
              +
            </button>
            {showAddMenu && (
              <div className="add-source-menu">
                {SOURCE_TYPES.map(({ type, label, Icon, emoji }) => (
                  <button
                    key={type}
                    onClick={() => { props.onAddSource(type); setShowAddMenu(false) }}
                  >
                    {emoji ? <span>{emoji}</span> : Icon && <Icon size={15} />}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <ul className="panel-list sources-list">
          {props.sources.length === 0 && (
            <li className="panel-empty">Ajoutez une source avec +</li>
          )}
          {[...props.sources].reverse().map((source, idx, arr) => (
            <li
              key={source.id}
              className={`${source.id === props.selectedSourceId ? 'selected' : ''} ${!source.visible ? 'hidden-source' : ''}`}
            >
              <button
                className="panel-list-item source-item"
                onClick={() => props.onSourceSelect(source.id)}
              >
                <SourceTypeIcon type={source.type} />
                <span className="source-label">{source.name}</span>
              </button>
              <div className="source-actions">
                <button
                  className="panel-item-action"
                  onClick={() => props.onUpdateSource(source.id, { visible: !source.visible })}
                  title={source.visible ? 'Masquer' : 'Afficher'}
                >
                  <IconEye visible={source.visible} />
                </button>
                <button
                  className="panel-item-action"
                  onClick={() => props.onMoveSource(source.id, 'up')}
                  disabled={idx === 0}
                  title="Monter"
                >↑</button>
                <button
                  className="panel-item-action"
                  onClick={() => props.onMoveSource(source.id, 'down')}
                  disabled={idx === arr.length - 1}
                  title="Descendre"
                >↓</button>
                <button
                  className="panel-item-action danger"
                  onClick={() => props.onRemoveSource(source.id)}
                  title="Supprimer"
                >
                  <IconTrash />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}

function SourceTypeIcon({ type }: { type: SourceType }) {
  const emojis: Partial<Record<SourceType, string>> = {
    window: '🪟', browser: '🌐', chat: '💬', alert: '🔔', game: '🎮'
  }
  if (emojis[type]) return <span className="source-type-emoji">{emojis[type]}</span>
  const icons = { display: IconDisplay, screen: IconDisplay, webcam: IconCamera, image: IconImage, text: IconText }
  const Icon = icons[type as keyof typeof icons]
  return <span className="source-type-icon"><Icon size={14} /></span>
}
