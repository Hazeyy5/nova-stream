import { useEffect, useState } from 'react'
import type { CapturePickerKind, CaptureSourceOption } from '../types'
import CapturePickerGrid from './CapturePickerGrid'
import './CapturePickerModal.css'

interface CapturePickerModalProps {
  kind: CapturePickerKind
  onSelect: (source: CaptureSourceOption) => void
  onClose: () => void
}

export default function CapturePickerModal({ kind, onSelect, onClose }: CapturePickerModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="capture-picker" onClick={(e) => e.stopPropagation()}>
        <CapturePickerGrid kind={kind} onSelect={onSelect} />
        <footer className="capture-picker-footer-inline">
          <button type="button" className="modal-close" onClick={onClose}>Annuler</button>
        </footer>
      </div>
    </div>
  )
}
