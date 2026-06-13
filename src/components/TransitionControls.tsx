import { memo } from 'react'
import type { TransitionType } from '../types'
import { TRANSITION_OPTIONS } from '../lib/transitionVisual'
import './TransitionControls.css'

interface TransitionControlsProps {
  transition: TransitionType
  transitionDuration: number
  onChange: (partial: { transition?: TransitionType; transitionDuration?: number }) => void
}

export default function TransitionControls({
  transition,
  transitionDuration,
  onChange
}: TransitionControlsProps) {
  return (
    <div className="transition-controls">
      <div className="transition-controls-header">
        <span className="transition-controls-label">Transition</span>
        <label className="transition-duration-field">
          <input
            type="number"
            min={100}
            max={2000}
            step={50}
            value={transitionDuration}
            disabled={transition === 'cut'}
            onChange={(e) => onChange({ transitionDuration: Number(e.target.value) })}
          />
          <span>ms</span>
        </label>
      </div>
      <div className="transition-preview-grid">
        {TRANSITION_OPTIONS.map((opt) => (
          <TransitionPreviewTile
            key={opt.id}
            id={opt.id}
            label={opt.label}
            active={transition === opt.id}
            onSelect={() => onChange({ transition: opt.id })}
          />
        ))}
      </div>
    </div>
  )
}

const TransitionPreviewTile = memo(function TransitionPreviewTile({
  id,
  label,
  active,
  onSelect
}: {
  id: TransitionType
  label: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`transition-preview-tile ${active ? 'active' : ''}`}
      onClick={onSelect}
      title={label}
    >
      <div className={`transition-preview-stage transition-preview-${id}`}>
        <span className="transition-preview-from" />
        <span className="transition-preview-to" />
      </div>
      <span className="transition-preview-label">{label}</span>
    </button>
  )
})
