import { useEffect, useState } from 'react'
import type { WebWidgetSettings } from '../types'

export function useWebWidgetSettings(): WebWidgetSettings {
  const [settings, setSettings] = useState<WebWidgetSettings>({})

  useEffect(() => {
    void window.novaStream.integrations.getWebWidgetSettings().then(setSettings)
    return window.novaStream.integrations.onWebWidgetSettings(setSettings)
  }, [])

  return settings
}
