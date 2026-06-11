export type AlertAnimation = 'pop' | 'slideUp' | 'slideLeft' | 'bounce' | 'fadeScale' | 'pulse'

export const ALERT_ANIMATIONS: { id: AlertAnimation; label: string }[] = [
  { id: 'pop', label: 'Pop (rebond)' },
  { id: 'slideUp', label: 'Glissée vers le haut' },
  { id: 'slideLeft', label: 'Glissée depuis la gauche' },
  { id: 'bounce', label: 'Rebond élastique' },
  { id: 'fadeScale', label: 'Fondu + zoom' },
  { id: 'pulse', label: 'Pulsation' }
]

export const ALERT_DURATION_MS = 5000
const ENTER_MS = 580
const EXIT_MS = 480

export interface AlertAnimState {
  opacity: number
  scale: number
  offsetX: number
  offsetY: number
  glowBoost: number
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
}

function applyEnter(kind: AlertAnimation, t: number): Pick<AlertAnimState, 'opacity' | 'scale' | 'offsetX' | 'offsetY'> {
  const p = easeOutCubic(t)
  switch (kind) {
    case 'slideUp':
      return { opacity: p, scale: 0.92 + p * 0.08, offsetX: 0, offsetY: (1 - easeOutBack(t)) * 0.4 }
    case 'slideLeft':
      return { opacity: p, scale: 0.96 + p * 0.04, offsetX: (1 - easeOutBack(t)) * -0.55, offsetY: 0 }
    case 'bounce':
      return { opacity: Math.min(1, t * 1.4), scale: easeOutElastic(t), offsetX: 0, offsetY: 0 }
    case 'fadeScale':
      return { opacity: p, scale: 0.72 + p * 0.28, offsetX: 0, offsetY: 0 }
    case 'pulse':
      return { opacity: p, scale: 0.88 + p * 0.12, offsetX: 0, offsetY: (1 - p) * 0.08 }
    case 'pop':
    default:
      return { opacity: p, scale: easeOutBack(t), offsetX: 0, offsetY: 0 }
  }
}

function applyExit(
  kind: AlertAnimation,
  t: number,
  base: Pick<AlertAnimState, 'opacity' | 'scale' | 'offsetX' | 'offsetY'>
): Pick<AlertAnimState, 'opacity' | 'scale' | 'offsetX' | 'offsetY'> {
  const p = easeOutCubic(t)
  const opacity = base.opacity * (1 - p)
  const scale = base.scale * (1 - p * 0.12)
  let offsetX = base.offsetX
  let offsetY = base.offsetY

  if (kind === 'slideUp') offsetY -= p * 0.22
  if (kind === 'slideLeft') offsetX -= p * 0.35
  if (kind === 'fadeScale') return { opacity, scale: base.scale * (1 - p * 0.2), offsetX, offsetY }

  return { opacity, scale, offsetX, offsetY }
}

export function computeAlertAnimation(
  kind: AlertAnimation,
  elapsedMs: number,
  durationMs = ALERT_DURATION_MS
): AlertAnimState {
  const enterT = clamp01(elapsedMs / ENTER_MS)
  const exitStart = durationMs - EXIT_MS
  const exitT = elapsedMs > exitStart ? clamp01((elapsedMs - exitStart) / EXIT_MS) : 0

  let state = applyEnter(kind, enterT)

  if (elapsedMs >= ENTER_MS && exitT === 0) {
    if (kind === 'pulse') {
      state = {
        ...state,
        scale: 1 + Math.sin(elapsedMs / 180) * 0.035
      }
    } else if (kind === 'bounce') {
      state = { ...state, scale: 1 + Math.sin(elapsedMs / 220) * 0.015 }
    }
  }

  if (exitT > 0) {
    state = applyExit(kind, exitT, state)
  }

  const glowBoost =
    enterT < 1
      ? 1 + (1 - enterT) * 0.8
      : exitT > 0
        ? 1 + exitT * 0.5
        : kind === 'pulse'
          ? 1 + Math.sin(elapsedMs / 200) * 0.4
          : 1

  return { ...state, glowBoost }
}

export function alertElapsedMs(alert: { shownAt?: number }, now = Date.now()): number {
  return Math.max(0, now - (alert.shownAt ?? now))
}
