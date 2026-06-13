import { useEffect, useState } from 'react'
import CapturePickerGrid from './CapturePickerGrid'
import type { CapturePickerOpenPayload, CaptureSourceOption } from '../types'
import './CapturePickerWindow.css'

export default function CapturePickerWindow() {
  const [payload, setPayload] = useState<CapturePickerOpenPayload | null>(null)

  useEffect(() => {
    const unsub = window.novaStream.capturePicker.onInit((p) => setPayload(p))
    window.novaStream.capturePicker.ready()
    return unsub
  }, [])

  const handleSelect = (capture: CaptureSourceOption) => {
    if (!payload) return
    window.novaStream.capturePicker.select({
      mode: payload.mode,
      kind: payload.kind,
      sourceId: payload.sourceId,
      capture
    })
  }

  if (!payload) {
    return <div className="capture-picker-window loading">Chargement…</div>
  }

  return (
    <div className="capture-picker-window">
      <CapturePickerGrid kind={payload.kind} onSelect={handleSelect} />
      <footer className="capture-picker-footer">
        <button
          type="button"
          className="capture-picker-cancel"
          onClick={() => window.novaStream.capturePicker.cancel()}
        >
          Annuler
        </button>
      </footer>
    </div>
  )
}
