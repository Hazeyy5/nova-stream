import type { Source } from '../types'
import './SourceInspector.css'

interface SourceInspectorProps {
  source: Source
  onUpdate: (partial: Partial<Source>) => void
  onClose: () => void
  onRecapture?: (kind: 'screen' | 'window') => void
}

export default function SourceInspector({ source, onUpdate, onClose, onRecapture }: SourceInspectorProps) {
  const t = source.transform

  return (
    <div className="source-inspector">
      <div className="inspector-header">
        <span>Propriétés — {source.name}</span>
        <button onClick={onClose} title="Fermer">✕</button>
      </div>
      <div className="inspector-body">
        <input
          value={source.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Nom de la source"
        />

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

        {source.type === 'browser' && (
          <input
            value={source.browserUrl ?? ''}
            onChange={(e) => onUpdate({ browserUrl: e.target.value })}
            placeholder="https://..."
          />
        )}

        {(source.type === 'screen' || source.type === 'window') && (
          <div className="inspector-capture-info">
            {source.captureName ? (
              <p className="inspector-capture-label">{source.captureName}</p>
            ) : (
              <p className="inspector-capture-label muted">Aucune capture sélectionnée</p>
            )}
            <button
              type="button"
              className="inspector-recapture-btn"
              onClick={() => onRecapture?.(source.type as 'screen' | 'window')}
            >
              Choisir {source.type === 'screen' ? 'un écran' : 'une fenêtre'}
            </button>
          </div>
        )}

        <label className="inspector-field">
          Mise à l&apos;échelle
          <select
            value={source.scaleMode ?? 'stretch'}
            onChange={(e) => onUpdate({ scaleMode: e.target.value as Source['scaleMode'] })}
          >
            <option value="stretch">Déformation</option>
            <option value="fit">Ajuster</option>
            <option value="fill">Remplir</option>
          </select>
        </label>

        <label className="inspector-field">
          Mode de fusion
          <select
            value={source.blendMode ?? 'normal'}
            onChange={(e) => onUpdate({ blendMode: e.target.value as Source['blendMode'] })}
          >
            <option value="normal">Normal</option>
            <option value="multiply">Multiplier</option>
            <option value="screen">Écran</option>
          </select>
        </label>

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
