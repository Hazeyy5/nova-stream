import { useEffect, useRef } from 'react'
import type { WebWidgetSettings } from '../types'
import { playAlertSound } from '../lib/alertSoundPlayer'
import { preloadAlertGif } from '../lib/alertGifCache'

export function useAlertSounds(settings: WebWidgetSettings): void {
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const playedIdsRef = useRef(new Set<string>())

  useEffect(() => {
    return window.novaStream.integrations.onAlert((alert) => {
      const alertCfg = settingsRef.current.alert
      if (alertCfg?.enabled === false) return
      if (alertCfg?.types?.[alert.type] === false) return
      if (alertCfg?.soundEnabled === false) return
      if (playedIdsRef.current.has(alert.id)) return

      if (alert.type === 'donation' && alert.gifUrl) {
        preloadAlertGif(alert.gifUrl)
      }

      playedIdsRef.current.add(alert.id)
      if (playedIdsRef.current.size > 200) {
        playedIdsRef.current.clear()
        playedIdsRef.current.add(alert.id)
      }

      playAlertSound(alert.type, {
        volume: alertCfg?.soundVolume ?? 80,
        customUrl: alertCfg?.sounds?.[alert.type]
      })
    })
  }, [])
}
