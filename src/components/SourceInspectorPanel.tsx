import { useEffect, useState } from 'react'
import type { ChatBoxStyle, MediaDevice, Source } from '../types'
import { CHAT_BOX_STYLES } from '../lib/chatBoxRenderer'
import './SourceInspector.css'

interface SourceInspectorPanelProps {
  source: Source
  onUpdate: (partial: Partial<Source>) => void
  onRecapture?: (kind: 'screen' | 'window') => void
}

export default function SourceInspectorPanel({ source, onUpdate, onRecapture }: SourceInspectorPanelProps) {
  const t = source.transform
  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([])

  useEffect(() => {
    window.novaStream.devices.listMedia().then((devices) => {
      setVideoDevices(devices.filter((d) => d.type === 'video'))
    })
  }, [])

  return (
    <div className="source-props-body source-props-panel">
      <label className="inspector-field">
        Nom
        <input
          value={source.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Nom de la source"
        />
      </label>

      {source.type === 'text' && (
        <label className="inspector-field">
          Texte
          <input
            value={source.textContent ?? ''}
            onChange={(e) => onUpdate({ textContent: e.target.value })}
            placeholder="Texte à afficher"
          />
        </label>
      )}

      {source.type === 'image' && (
        <label className="inspector-field">
          URL de l&apos;image
          <input
            value={source.imageUrl ?? ''}
            onChange={(e) => onUpdate({ imageUrl: e.target.value })}
            placeholder="https://..."
          />
        </label>
      )}

      {source.type === 'browser' && (
        <label className="inspector-field">
          URL
          <input
            value={source.browserUrl ?? ''}
            onChange={(e) => onUpdate({ browserUrl: e.target.value })}
            placeholder="https://..."
          />
        </label>
      )}

      {(source.type === 'screen' || source.type === 'window') && (
        <div className="inspector-capture-info">
          <span className="inspector-field-label">Capture</span>
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

      {source.type === 'webcam' && (
        <p className="inspector-hint">
          La webcam utilise le périphérique défini dans Paramètres → Vidéo.
          {videoDevices.length > 0 && (
            <> Détectées : {videoDevices.map((d) => d.name).join(', ')}</>
          )}
        </p>
      )}

      <fieldset className="inspector-section">
        <legend>Affichage</legend>
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

        <div className="inspector-grid">
          <label className="inspector-field">
            X (%)
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(t.x)}
              disabled={source.locked}
              onChange={(e) => onUpdate({ transform: { ...t, x: Number(e.target.value) } })}
            />
          </label>
          <label className="inspector-field">
            Y (%)
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(t.y)}
              disabled={source.locked}
              onChange={(e) => onUpdate({ transform: { ...t, y: Number(e.target.value) } })}
            />
          </label>
          <label className="inspector-field">
            Largeur (%)
            <input
              type="number"
              min={1}
              max={100}
              value={Math.round(t.width)}
              disabled={source.locked}
              onChange={(e) => onUpdate({ transform: { ...t, width: Number(e.target.value) } })}
            />
          </label>
          <label className="inspector-field">
            Hauteur (%)
            <input
              type="number"
              min={1}
              max={100}
              value={Math.round(t.height)}
              disabled={source.locked}
              onChange={(e) => onUpdate({ transform: { ...t, height: Number(e.target.value) } })}
            />
          </label>
        </div>

        <label className="inspector-field">
          Opacité ({source.opacity ?? 100} %)
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={source.opacity ?? 100}
            onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
          />
        </label>

        <label className="inspector-checkbox">
          <input
            type="checkbox"
            checked={source.locked}
            onChange={(e) => onUpdate({ locked: e.target.checked })}
          />
          Verrouiller la position
        </label>

        <div className="inspector-presets">
          <button type="button" onClick={() => onUpdate({ transform: { ...t, x: 0, y: 0, width: 100, height: 100 } })}>
            Plein écran
          </button>
          <button type="button" onClick={() => onUpdate({ transform: { ...t, x: 72, y: 68, width: 22, height: 22 } })}>
            Facecam
          </button>
        </div>
      </fieldset>

      {['webcam', 'image', 'screen', 'window', 'browser', 'display'].includes(source.type) && (
        <fieldset className="inspector-section">
          <legend>Chroma key</legend>
          <label className="inspector-checkbox">
            <input
              type="checkbox"
              checked={source.chromaKey?.enabled ?? false}
              onChange={(e) =>
                onUpdate({
                  chromaKey: e.target.checked
                    ? {
                        enabled: true,
                        color: source.chromaKey?.color ?? '#00ff00',
                        similarity: source.chromaKey?.similarity ?? 0.4,
                        smoothness: source.chromaKey?.smoothness ?? 0.12
                      }
                    : { ...(source.chromaKey ?? { color: '#00ff00', similarity: 0.4, smoothness: 0.12 }), enabled: false }
                })
              }
            />
            Activer l&apos;incrustation (fond vert/bleu)
          </label>
          {source.chromaKey?.enabled && (
            <>
              <label className="inspector-field">
                Couleur du fond
                <input
                  type="color"
                  value={source.chromaKey.color}
                  onChange={(e) =>
                    onUpdate({ chromaKey: { ...source.chromaKey!, color: e.target.value } })
                  }
                />
              </label>
              <label className="inspector-field">
                Similarité ({Math.round((source.chromaKey.similarity ?? 0.4) * 100)} %)
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.05}
                  value={source.chromaKey.similarity ?? 0.4}
                  onChange={(e) =>
                    onUpdate({ chromaKey: { ...source.chromaKey!, similarity: Number(e.target.value) } })
                  }
                />
              </label>
              <label className="inspector-field">
                Lissage ({Math.round((source.chromaKey.smoothness ?? 0.12) * 100)} %)
                <input
                  type="range"
                  min={0.02}
                  max={0.4}
                  step={0.02}
                  value={source.chromaKey.smoothness ?? 0.12}
                  onChange={(e) =>
                    onUpdate({ chromaKey: { ...source.chromaKey!, smoothness: Number(e.target.value) } })
                  }
                />
              </label>
            </>
          )}
        </fieldset>
      )}

      {source.type === 'chat' && (
        <fieldset className="inspector-section">
          <legend>Apparence du chat</legend>
          <label className="inspector-field">
            Design
            <select
              value={source.chatStyle ?? 'classic'}
              onChange={(e) => onUpdate({ chatStyle: e.target.value as ChatBoxStyle })}
            >
              {CHAT_BOX_STYLES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="inspector-field">
            Messages affichés ({source.chatMaxMessages ?? 6})
            <input
              type="range"
              min={1}
              max={12}
              value={source.chatMaxMessages ?? 6}
              onChange={(e) => onUpdate({ chatMaxMessages: Number(e.target.value) })}
            />
          </label>
          <p className="inspector-hint">
            Connectez Twitch dans Apps pour alimenter ce widget en direct.
          </p>
        </fieldset>
      )}

      {source.type === 'alert' && (
        <p className="inspector-hint">
          Widget d&apos;intégration — connectez Twitch dans l&apos;onglet Apps pour alimenter ce widget.
        </p>
      )}
    </div>
  )
}
