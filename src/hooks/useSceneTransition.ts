import { useState, useCallback, useRef } from 'react'
import type { TransitionType } from '../types'

export function useSceneTransition(
  transition: TransitionType,
  durationMs: number,
  onSwitch: (sceneId: string) => void
) {
  const [fadeOpacity, setFadeOpacity] = useState(1)
  const busyRef = useRef(false)

  const switchScene = useCallback(
    (sceneId: string, currentSceneId: string) => {
      if (sceneId === currentSceneId) return
      if (transition === 'cut' || busyRef.current) {
        onSwitch(sceneId)
        return
      }

      busyRef.current = true
      const half = Math.max(50, durationMs / 2)
      const start = performance.now()
      let switched = false

      const tick = (now: number) => {
        const elapsed = now - start
        if (elapsed < half) {
          setFadeOpacity(1 - elapsed / half)
          requestAnimationFrame(tick)
        } else if (elapsed < half * 2) {
          if (!switched) {
            switched = true
            onSwitch(sceneId)
          }
          setFadeOpacity((elapsed - half) / half)
          requestAnimationFrame(tick)
        } else {
          setFadeOpacity(1)
          busyRef.current = false
        }
      }

      requestAnimationFrame(tick)
    },
    [transition, durationMs, onSwitch]
  )

  return { switchScene, fadeOpacity }
}
