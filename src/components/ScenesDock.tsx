import { useState, useRef, useEffect } from 'react'
import type { Scene } from '../types'
import { IconTrash } from './Icons'
import './DockPanel.css'

interface ScenesDockProps {
  scenes: Scene[]
  activeSceneId: string
  onSceneSelect: (id: string) => void
  onAddScene: () => void
  onRemoveScene: (id: string) => void
  onRenameScene: (id: string, name: string) => void
}

export default function ScenesDock({
  scenes,
  activeSceneId,
  onSceneSelect,
  onAddScene,
  onRemoveScene,
  onRenameScene
}: ScenesDockProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  return (
    <div className="dock-panel">
      <div className="dock-panel-header">
        <h3>Scènes</h3>
        <button className="dock-add-btn" onClick={onAddScene} title="Ajouter une scène">+</button>
      </div>
      <ul className="dock-list">
        {scenes.map((scene) => (
          <li
            key={scene.id}
            className={scene.id === activeSceneId ? 'active' : ''}
          >
            {editingId === scene.id ? (
              <input
                ref={inputRef}
                className="dock-rename-input"
                defaultValue={scene.name}
                onBlur={(e) => {
                  onRenameScene(scene.id, e.target.value || scene.name)
                  setEditingId(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setEditingId(null)
                }}
              />
            ) : (
              <button
                className="dock-list-btn"
                onClick={() => onSceneSelect(scene.id)}
                onDoubleClick={() => setEditingId(scene.id)}
              >
                {scene.name}
              </button>
            )}
            {scenes.length > 1 && (
              <button
                className="dock-item-action"
                onClick={() => onRemoveScene(scene.id)}
                title="Supprimer la scène"
              >
                <IconTrash size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
