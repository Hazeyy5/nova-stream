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
  onDuplicateScene: (id: string) => void
  onMoveScene: (id: string, direction: 'up' | 'down') => void
  onExportScenes: () => void
  onImportScenes: () => void
}

export default function ScenesDock({
  scenes,
  activeSceneId,
  onSceneSelect,
  onAddScene,
  onRemoveScene,
  onRenameScene,
  onDuplicateScene,
  onMoveScene,
  onExportScenes,
  onImportScenes
}: ScenesDockProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeIndex = scenes.findIndex((s) => s.id === activeSceneId)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  return (
    <div className="dock-panel">
      <div className="dock-panel-header">
        <h3>Scènes</h3>
        <div className="dock-header-actions">
          <button className="dock-add-btn" onClick={onExportScenes} title="Exporter les scènes">↓</button>
          <button className="dock-add-btn" onClick={onImportScenes} title="Importer des scènes">↑</button>
          <button className="dock-add-btn" onClick={onAddScene} title="Ajouter une scène">+</button>
        </div>
      </div>
      <ul className="dock-list">
        {scenes.map((scene, index) => (
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
            <button
              className="dock-item-action"
              onClick={() => onMoveScene(scene.id, 'up')}
              disabled={index === 0}
              title="Monter"
            >
              ▴
            </button>
            <button
              className="dock-item-action"
              onClick={() => onMoveScene(scene.id, 'down')}
              disabled={index === scenes.length - 1}
              title="Descendre"
            >
              ▾
            </button>
            <button
              className="dock-item-action"
              onClick={() => onDuplicateScene(scene.id)}
              title="Dupliquer la scène"
            >
              ⧉
            </button>
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
      {activeIndex >= 0 && (
        <p className="dock-scene-hint">Scène {activeIndex + 1} / {scenes.length}</p>
      )}
    </div>
  )
}
