import type { Source } from '../types'
import './SourceInspector.css'

interface SourceInspectorProps {
  source: Source
  onUpdate: (partial: Partial<Source>) => void
  onClose: () => void
}

export default function SourceInspector({ source, onUpdate, onClose }: SourceInspectorProps) {
  const t = source.transform

  return (
    <div className="source-inspector">
      <div className="inspector-header">
        <span>Propriétés — {source.name}</span>
        <button onClick={onClose} title="Fermer">✕</button>
      </div>
      <div className="inspector-body">
        {source.type === 'text' && (
          <input
            value={source.textContent ?? ''}
            onChange={(e) => onUpdate({ textContent: e.target.value })}
            placeholder="Texte à afficher"
          />
        )}
        {source.type === 'image' && (
          <input
            value={source.imageUrl ?? ''}
            onChange={(e) => onUpdate({ imageUrl: e.target.value })}
            placeholder="URL de l'image"
          />
        )}
        <div className="inspector-presets">
          <button onClick={() => onUpdate({ transform: { ...t, x: 0, y: 0, width: 100, height: 100 } })}>
            Plein écran
          </button>
          <button onClick={() => onUpdate({ transform: { ...t, x: 72, y: 68, width: 22, height: 22 } })}>
            Facecam
          </button>
        </div>
      </div>
    </div>
  )
}
