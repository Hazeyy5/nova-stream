import { useState, useCallback, useRef } from 'react'
import type { TransitionType } from '../types'
import {
  computeTransitionFrame,
  type TransitionFrame,
  transitionFrameToStyle
} from '../lib/transitionVisual'

const DEFAULT_FRAME: TransitionFrame = {
  opacity: 1,
  transform: 'none',
  clipPath: 'inset(0 0 0 0)',
  filter: 'none'
}

export function useSceneTransition(
  transition: TransitionType,
  durationMs: number,
  onSwitch: (sceneId: string) => void
) {
  const [frame, setFrame] = useState<TransitionFrame>(DEFAULT_FRAME)
  const busyRef = useRef(false)

  const switchScene = useCallback(
    (sceneId: string, currentSceneId: string) => {
      if (sceneId === currentSceneId) return
      if (transition === 'cut' || busyRef.current) {
        onSwitch(sceneId)
        setFrame(DEFAULT_FRAME)
        return
      }

      busyRef.current = true
      const half = Math.max(50, durationMs / 2)
      const start = performance.now()
      let switched = false

      const tick = (now: number) => {
        const elapsed = now - start
        if (elapsed < half * 2) {
          if (!switched && elapsed >= half) {
            switched = true
            onSwitch(sceneId)
          }
          setFrame(computeTransitionFrame(transition, elapsed, half))
          requestAnimationFrame(tick)
        } else {
          setFrame(DEFAULT_FRAME)
          busyRef.current = false
        }
      }

      requestAnimationFrame(tick)
    },
    [transition, durationMs, onSwitch]
  )

  return {
    switchScene,
    transitionStyle: transitionFrameToStyle(frame)
  }
}
