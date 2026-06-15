export const MIN_GAIN_DB = -60
export const MAX_GAIN_DB = 26
export const DEFAULT_GAIN_DB = 0

export function parseGainDb(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_GAIN_DB
  return Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, n))
}

export function gainDbToLinear(db: number): number {
  if (db <= MIN_GAIN_DB) return 0
  return Math.pow(10, db / 20)
}

export function formatGainDb(db: number, muted: boolean): string {
  if (muted) return 'MUTE'
  if (db <= MIN_GAIN_DB + 0.5) return '-inf'
  const sign = db > 0 ? '+' : ''
  return `${sign}${db.toFixed(1)} dB`
}

export function gainDbToSliderPercent(db: number): string {
  const clamped = Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, db))
  const pct = ((clamped - MIN_GAIN_DB) / (MAX_GAIN_DB - MIN_GAIN_DB)) * 100
  return `${pct}%`
}

/** Migration depuis l'ancien slider 0–100 % (100 % = 0 dB). */
export function percentVolumeToGainDb(percent: number): number {
  if (percent <= 0) return MIN_GAIN_DB
  if (percent >= 100) return DEFAULT_GAIN_DB
  return Math.max(MIN_GAIN_DB, 20 * Math.log10(percent / 100))
}

export function resolveMicGainDb(settings: {
  audioGainDb?: unknown
  audioVolume?: unknown
}): number {
  if (settings.audioGainDb !== undefined && settings.audioGainDb !== null) {
    return parseGainDb(settings.audioGainDb)
  }
  if (typeof settings.audioVolume === 'number') return percentVolumeToGainDb(settings.audioVolume)
  return DEFAULT_GAIN_DB
}

export function resolveDesktopGainDb(settings: {
  desktopAudioGainDb?: unknown
  desktopAudioVolume?: unknown
}): number {
  if (settings.desktopAudioGainDb !== undefined && settings.desktopAudioGainDb !== null) {
    return parseGainDb(settings.desktopAudioGainDb)
  }
  if (typeof settings.desktopAudioVolume === 'number') return percentVolumeToGainDb(settings.desktopAudioVolume)
  return DEFAULT_GAIN_DB
}

export function migrateStreamSettings(raw: Record<string, unknown>): Record<string, unknown> {
  const next = { ...raw }
  if (typeof next.audioGainDb !== 'number' && typeof next.audioVolume === 'number') {
    next.audioGainDb = percentVolumeToGainDb(next.audioVolume as number)
  }
  if (typeof next.desktopAudioGainDb !== 'number' && typeof next.desktopAudioVolume === 'number') {
    next.desktopAudioGainDb = percentVolumeToGainDb(next.desktopAudioVolume as number)
  }
  if (next.settingsMigratedV064 !== true) {
    next.audioEnabled = true
    next.desktopAudioEnabled = true
    next.settingsMigratedV064 = true
  }
  return next
}
