import type { Source } from '../types'
import './SourceProperties.css'

interface SourcePropertiesProps {
  source: Source | null
  onUpdate: (partial: Partial<Source>) => void
}

export default function SourceProperties({ source, onUpdate }: SourcePropertiesProps) {
  if (!source) {
    return (
      <div className="source-props empty">
        <p>Sélectionnez une source pour modifier ses propriétés</p>
      </div>
    )
  }

  const t = source.transform

  return (
    <div className="source-props">
      <h4>Propriétés — {source.name}</h4>

      <label className="prop-field">
        Nom
        <input
          value={source.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </label>

      {source.type === 'text' && (
        <label className="prop-field">
          Texte affiché
          <input
            value={source.textContent ?? ''}
            onChange={(e) => onUpdate({ textContent: e.target.value })}
          />
        </label>
      )}

      {source.type === 'image' && (
        <label className="prop-field">
          URL de l'image
          <input
            value={source.imageUrl ?? ''}
            onChange={(e) => onUpdate({ imageUrl: e.target.value })}
            placeholder="https://..."
          />
        </label>
      )}

      <div className="prop-grid">
        <label className="prop-field">
          X (%)
          <input
            type="number" min={0} max={100}
            value={Math.round(t.x)}
            onChange={(e) => onUpdate({ transform: { ...t, x: Number(e.target.value) } })}
            disabled={source.locked}
          />
        </label>
        <label className="prop-field">
          Y (%)
          <input
            type="number" min={0} max={100}
            value={Math.round(t.y)}
            onChange={(e) => onUpdate({ transform: { ...t, y: Number(e.target.value) } })}
            disabled={source.locked}
          />
        </label>
        <label className="prop-field">
          Largeur (%)
          <input
            type="number" min={5} max={100}
            value={Math.round(t.width)}
            onChange={(e) => onUpdate({ transform: { ...t, width: Number(e.target.value) } })}
            disabled={source.locked}
          />
        </label>
        <label className="prop-field">
          Hauteur (%)
          <input
            type="number" min={5} max={100}
            value={Math.round(t.height)}
            onChange={(e) => onUpdate({ transform: { ...t, height: Number(e.target.value) } })}
            disabled={source.locked}
          />
        </label>
      </div>

      <label className="prop-checkbox">
        <input
          type="checkbox"
          checked={source.locked}
          onChange={(e) => onUpdate({ locked: e.target.checked })}
        />
        Verrouiller la position
      </label>

      {(source.type === 'webcam' || source.type === 'display') && (
        <div className="prop-presets">
          <span className="prop-presets-label">Positions rapides</span>
          <div className="preset-btns">
            <button onClick={() => onUpdate({ transform: { ...t, x: 0, y: 0, width: 100, height: 100 } })}>
              Plein écran
            </button>
            <button onClick={() => onUpdate({ transform: { ...t, x: 72, y: 68, width: 22, height: 22 } })}>
              Coin bas-droit
            </button>
            <button onClick={() => onUpdate({ transform: { ...t, x: 2, y: 68, width: 22, height: 22 } })}>
              Coin bas-gauche
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
