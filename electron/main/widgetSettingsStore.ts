import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { WebWidgetSettings } from '../../src/types'

const FILE = () => join(app.getPath('userData'), 'widget-settings.json')

export function loadWidgetSettings(): WebWidgetSettings {
  try {
    const path = FILE()
    if (!existsSync(path)) return {}
    return JSON.parse(readFileSync(path, 'utf-8')) as WebWidgetSettings
  } catch {
    return {}
  }
}

export function saveWidgetSettings(settings: WebWidgetSettings): void {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  writeFileSync(FILE(), JSON.stringify(settings, null, 2))
}
