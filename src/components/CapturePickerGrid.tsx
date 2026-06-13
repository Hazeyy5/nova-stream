import { useEffect, useState } from 'react'
import type { CapturePickerKind, CaptureSourceOption } from '../types'
import './CapturePickerModal.css'

const TITLES: Record<CapturePickerKind, string> = {
  screen: 'Choisir un écran',
  window: 'Choisir une fenêtre',
  game: 'Choisir un jeu'
}

const HINTS: Partial<Record<CapturePickerKind, string>> = {
  game: 'Lancez votre jeu, puis sélectionnez sa fenêtre. Les applications système sont masquées.'
}

interface CapturePickerGridProps {
  kind: CapturePickerKind
  onSelect: (source: CaptureSourceOption) => void
}

export default function CapturePickerGrid({ kind, onSelect }: CapturePickerGridProps) {
  const [sources, setSources] = useState<CaptureSourceOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    window.novaStream.devices.getCaptureSources(kind)
      .then(setSources)
      .finally(() => setLoading(false))
  }, [kind])

  return (
    <>
      <header className="capture-picker-header">
        <h2>{TITLES[kind]}</h2>
      </header>
      <div className="capture-picker-body">
        {HINTS[kind] && <p className="capture-picker-hint">{HINTS[kind]}</p>}
        {loading && <p className="capture-picker-hint">Chargement des sources…</p>}
        {!loading && sources.length === 0 && (
          <p className="capture-picker-hint">
            {kind === 'game'
              ? 'Aucun jeu détecté. Lancez un jeu en mode fenêtré ou sans bordure, puis réessayez.'
              : 'Aucune source trouvée.'}
          </p>
        )}
        <div className="capture-picker-grid">
          {sources.map((src) => (
            <button
              key={src.id}
              type="button"
              className="capture-picker-item"
              onClick={() => onSelect(src)}
            >
              {src.thumbnail ? (
                <img src={src.thumbnail} alt="" className="capture-picker-thumb" />
              ) : (
                <div className="capture-picker-thumb placeholder" />
              )}
              <span className="capture-picker-name">{src.name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
