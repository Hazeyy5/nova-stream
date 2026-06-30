import { useEffect } from 'react'
import type { AppThemeId } from '../lib/appThemes'
import { applyAppTheme, DEFAULT_APP_THEME, DEFAULT_CUSTOM_ACCENT } from '../lib/appThemes'
import type { StreamSettings } from '../types'

export function applyThemeFromSettings(settings: Pick<StreamSettings, 'appThemeId' | 'appAccentColor'>): void {
  applyAppTheme(settings.appThemeId ?? DEFAULT_APP_THEME, settings.appAccentColor ?? DEFAULT_CUSTOM_ACCENT)
}

export function useAppTheme(settings: StreamSettings): void {
  useEffect(() => {
    applyThemeFromSettings(settings)
  }, [settings.appThemeId, settings.appAccentColor])
}

export function resolveThemeId(raw: unknown): AppThemeId {
  const ids: AppThemeId[] = ['nova', 'midnight', 'ocean', 'forest', 'custom']
  return ids.includes(raw as AppThemeId) ? (raw as AppThemeId) : DEFAULT_APP_THEME
}
