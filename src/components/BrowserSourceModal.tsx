import { useState } from 'react'
import './CapturePickerModal.css'

interface BrowserSourceModalProps {
  initialUrl?: string
  onConfirm: (url: string) => void
  onClose: () => void
}

export default function BrowserSourceModal({ initialUrl = 'https://', onConfirm, onClose }: BrowserSourceModalProps) {
  const [url, setUrl] = useState(initialUrl)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="capture-picker browser-source-modal" onClick={(e) => e.stopPropagation()}>
        <header className="capture-picker-header">
          <h2>Source navigateur</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </header>
        <div className="capture-picker-body">
          <p className="capture-picker-hint" style={{ padding: '0 0 12px' }}>
            Entrez l'URL d'une page web à afficher dans votre scène (widgets, alertes, etc.).
          </p>
          <label className="browser-url-field">
            URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && url.trim() && onConfirm(url.trim())}
            />
          </label>
          <div className="browser-modal-actions">
            <button type="button" className="modal-btn secondary" onClick={onClose}>Annuler</button>
            <button
              type="button"
              className="modal-btn primary"
              disabled={!url.trim()}
              onClick={() => onConfirm(url.trim())}
            >
              Ajouter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
