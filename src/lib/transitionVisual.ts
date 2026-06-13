import type { CSSProperties } from 'react'
import type { TransitionType } from '../types'

export interface TransitionFrame {
  opacity: number
  transform: string
  clipPath: string
  filter: string
}

export const TRANSITION_OPTIONS: { id: TransitionType; label: string }[] = [
  { id: 'cut', label: 'Coupe' },
  { id: 'fade', label: 'Fondu' },
  { id: 'slideLeft', label: 'Glisser ←' },
  { id: 'slideRight', label: 'Glisser →' },
  { id: 'slideUp', label: 'Glisser ↑' },
  { id: 'slideDown', label: 'Glisser ↓' },
  { id: 'wipe', label: 'Balayage' },
  { id: 'zoom', label: 'Zoom' }
]

const DEFAULT_FRAME: TransitionFrame = {
  opacity: 1,
  transform: 'none',
  clipPath: 'inset(0 0 0 0)',
  filter: 'none'
}

export function computeTransitionFrame(
  type: TransitionType,
  elapsed: number,
  half: number
): TransitionFrame {
  if (type === 'cut') return DEFAULT_FRAME

  const outProgress = Math.min(1, elapsed / half)
  const inProgress = Math.min(1, Math.max(0, (elapsed - half) / half))
  const phase = elapsed < half ? 'out' : 'in'
  const p = phase === 'out' ? outProgress : inProgress

  if (type === 'fade') {
    return {
      ...DEFAULT_FRAME,
      opacity: phase === 'out' ? 1 - outProgress : inProgress
    }
  }

  if (type === 'slideLeft') {
    const x = phase === 'out' ? -100 * outProgress : (1 - inProgress) * 100
    return { ...DEFAULT_FRAME, transform: `translateX(${x}%)` }
  }

  if (type === 'slideRight') {
    const x = phase === 'out' ? 100 * outProgress : -(1 - inProgress) * 100
    return { ...DEFAULT_FRAME, transform: `translateX(${x}%)` }
  }

  if (type === 'slideUp') {
    const y = phase === 'out' ? -100 * outProgress : (1 - inProgress) * 100
    return { ...DEFAULT_FRAME, transform: `translateY(${y}%)` }
  }

  if (type === 'slideDown') {
    const y = phase === 'out' ? 100 * outProgress : -(1 - inProgress) * 100
    return { ...DEFAULT_FRAME, transform: `translateY(${y}%)` }
  }

  if (type === 'wipe') {
    const right = phase === 'out' ? 100 * outProgress : 100 * (1 - inProgress)
    return { ...DEFAULT_FRAME, clipPath: `inset(0 ${right}% 0 0)` }
  }

  if (type === 'zoom') {
    const scale = phase === 'out' ? 1 - outProgress * 0.35 : 0.65 + inProgress * 0.35
    const opacity = phase === 'out' ? 1 - outProgress * 0.4 : 0.6 + inProgress * 0.4
    return { ...DEFAULT_FRAME, transform: `scale(${scale})`, opacity }
  }

  return DEFAULT_FRAME
}

export function transitionFrameToStyle(frame: TransitionFrame): CSSProperties {
  return {
    opacity: frame.opacity,
    transform: frame.transform,
    clipPath: frame.clipPath,
    filter: frame.filter,
    transition: 'none'
  }
}
