import { useEffect, useState } from 'react'
import type { CaptureSourceOption } from '../types'
import './CapturePickerModal.css'

interface CapturePickerModalProps {
  kind: 'screen' | 'window'
  onSelect: (source: CaptureSourceOption) => void
  onClose: () => void
}

export default function CapturePickerModal({ kind, onSelect, onClose }: CapturePickerModalProps) {
  const [sources, setSources] = useState<CaptureSourceOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.novaStream.devices.getCaptureSources(kind)
      .then(setSources)
      .finally(() => setLoading(false))
  }, [kind])

  const title = kind === 'screen' ? 'Choisir un écran' : 'Choisir une fenêtre'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="capture-picker" onClick={(e) => e.stopPropagation()}>
        <header className="capture-picker-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </header>
        <div className="capture-picker-body">
          {loading && <p className="capture-picker-hint">Chargement des sources…</p>}
          {!loading && sources.length === 0 && (
            <p className="capture-picker-hint">Aucune source trouvée.</p>
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
      </div>
    </div>
  )
}
