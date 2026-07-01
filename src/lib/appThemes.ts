export type AppThemeId = 'nova' | 'midnight' | 'ocean' | 'forest' | 'custom'

export interface AppThemePreset {
  id: AppThemeId
  name: string
  description: string
  swatch: string
  vars: Record<string, string>
}

const NOVA_VARS: Record<string, string> = {
  '--bg-deep': '#0f0f18',
  '--bg-primary': '#161625',
  '--bg-secondary': '#1c1c2e',
  '--bg-dock': 'rgba(28, 28, 46, 0.72)',
  '--bg-glass': 'rgba(32, 32, 52, 0.55)',
  '--bg-elevated': 'rgba(40, 40, 62, 0.75)',
  '--bg-hover': 'rgba(54, 54, 78, 0.85)',
  '--accent': '#a78bfa',
  '--accent-hover': '#c4b5fd',
  '--purple': '#c4b5fd',
  '--purple-bright': '#a78bfa',
  '--purple-deep': '#7c3aed',
  '--border-glow': 'rgba(167, 139, 250, 0.22)',
  '--pink': '#fb7185',
  '--record': '#c084fc'
}

export const APP_THEME_PRESETS: AppThemePreset[] = [
  {
    id: 'nova',
    name: 'Nova',
    description: 'Violet et rose — thème officiel Nova Stream.',
    swatch: 'linear-gradient(135deg, #7c3aed, #fb7185)',
    vars: NOVA_VARS
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Noir profond avec accents discrets.',
    swatch: 'linear-gradient(135deg, #0a0a0f, #334155)',
    vars: {
      ...NOVA_VARS,
      '--bg-deep': '#050508',
      '--bg-primary': '#0a0a10',
      '--bg-secondary': '#101018',
      '--bg-dock': 'rgba(12, 12, 20, 0.88)',
      '--bg-glass': 'rgba(16, 16, 26, 0.65)',
      '--bg-elevated': 'rgba(22, 22, 34, 0.9)',
      '--bg-hover': 'rgba(38, 38, 54, 0.9)',
      '--accent': '#94a3b8',
      '--accent-hover': '#cbd5e1',
      '--purple': '#cbd5e1',
      '--purple-bright': '#94a3b8',
      '--purple-deep': '#64748b',
      '--border-glow': 'rgba(148, 163, 184, 0.15)',
      '--record': '#94a3b8'
    }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Bleu cyan — style studio pro.',
    swatch: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
    vars: {
      ...NOVA_VARS,
      '--bg-deep': '#071018',
      '--bg-primary': '#0c1520',
      '--bg-secondary': '#101c2a',
      '--accent': '#38bdf8',
      '--accent-hover': '#7dd3fc',
      '--purple': '#7dd3fc',
      '--purple-bright': '#38bdf8',
      '--purple-deep': '#0284c7',
      '--border-glow': 'rgba(56, 189, 248, 0.22)',
      '--record': '#38bdf8',
      '--pink': '#22d3ee'
    }
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Verts sombres, ambiance chill.',
    swatch: 'linear-gradient(135deg, #059669, #34d399)',
    vars: {
      ...NOVA_VARS,
      '--bg-deep': '#071210',
      '--bg-primary': '#0c1816',
      '--bg-secondary': '#102220',
      '--accent': '#34d399',
      '--accent-hover': '#6ee7b7',
      '--purple': '#6ee7b7',
      '--purple-bright': '#34d399',
      '--purple-deep': '#059669',
      '--border-glow': 'rgba(52, 211, 153, 0.2)',
      '--record': '#34d399',
      '--pink': '#2dd4bf'
    }
  },
  {
    id: 'custom',
    name: 'Personnalisé',
    description: 'Choisissez votre couleur d\'accent.',
    swatch: 'linear-gradient(135deg, #a78bfa, #c084fc)',
    vars: NOVA_VARS
  }
]

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return null
  const n = Number.parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number } {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  }
}

function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return rgbToHex(
    rgb.r + (255 - rgb.r) * amount,
    rgb.g + (255 - rgb.g) * amount,
    rgb.b + (255 - rgb.b) * amount
  )
}

function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return rgbToHex(rgb.r * (1 - amount), rgb.g * (1 - amount), rgb.b * (1 - amount))
}

function rgba(rgb: { r: number; g: number; b: number }, alpha: number): string {
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`
}

/** Dérive toutes les variables CSS liées à l'accent (gradients, ombres, surbrillances). */
export function buildDerivedThemeVars(vars: Record<string, string>): Record<string, string> {
  const accent = vars['--accent'] ?? '#a78bfa'
  const accentHover = vars['--accent-hover'] ?? lighten(accent, 0.18)
  const purpleDeep = vars['--purple-deep'] ?? darken(accent, 0.28)
  const record = vars['--record'] ?? accent
  const bgDeep = vars['--bg-deep'] ?? '#0f0f18'
  const bgPrimary = vars['--bg-primary'] ?? '#161625'
  const bgSecondary = vars['--bg-secondary'] ?? '#1c1c2e'
  const bgGlowSecondary = vars['--bg-glow-secondary'] ?? vars['--pink'] ?? accent

  const accentRgb = hexToRgb(accent)
  const deepRgb = hexToRgb(purpleDeep)
  const recordRgb = hexToRgb(record)
  const bgDeepRgb = hexToRgb(bgDeep)
  const bgPrimaryRgb = hexToRgb(bgPrimary)
  const bgSecondaryRgb = hexToRgb(bgSecondary)
  const glowSecondaryRgb = hexToRgb(bgGlowSecondary)

  if (!accentRgb || !deepRgb || !recordRgb || !bgDeepRgb || !bgPrimaryRgb || !bgSecondaryRgb) {
    return {}
  }

  const navTop = mixRgb(bgDeepRgb, bgPrimaryRgb, 0.35)
  const navBottom = mixRgb(bgPrimaryRgb, bgSecondaryRgb, 0.4)
  const headerRgb = mixRgb(bgPrimaryRgb, bgSecondaryRgb, 0.25)
  const dockHeaderTop = mixRgb(bgSecondaryRgb, bgPrimaryRgb, 0.55)
  const dockHeaderBottom = mixRgb(bgPrimaryRgb, bgSecondaryRgb, 0.15)

  return {
    '--accent-hover': accentHover,
    '--accent-rgb': `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`,
    '--purple-deep-rgb': `${deepRgb.r}, ${deepRgb.g}, ${deepRgb.b}`,
    '--record-rgb': `${recordRgb.r}, ${recordRgb.g}, ${recordRgb.b}`,
    '--accent-dim': rgba(accentRgb, 0.5),
    '--accent-bg': rgba(deepRgb, 0.14),
    '--accent-glow': rgba(accentRgb, 0.4),
    '--purple-dim': rgba(deepRgb, 0.45),
    '--purple-bg': rgba(deepRgb, 0.16),
    '--purple-glow': rgba(accentRgb, 0.45),
    '--gradient-purple': `linear-gradient(135deg, ${accent} 0%, ${purpleDeep} 100%)`,
    '--gradient-brand': `linear-gradient(135deg, ${accentHover} 0%, ${accent} 45%, ${purpleDeep} 100%)`,
    '--gradient-accent': `linear-gradient(135deg, ${accent} 0%, ${purpleDeep} 100%)`,
    '--gradient-meter': `linear-gradient(90deg, ${accent} 0%, ${accentHover} 100%)`,
    '--bg-glow-1': rgba(deepRgb, 0.12),
    '--bg-glow-2': glowSecondaryRgb ? rgba(glowSecondaryRgb, 0.08) : rgba(accentRgb, 0.08),
    '--bg-glow-3': rgba(deepRgb, 0.06),
    '--record': record,
    '--nav-active-text': lighten(accent, 0.35),
    '--header-bg': rgba(headerRgb, 0.85),
    '--status-bar-bg': rgba(bgDeepRgb, 0.95),
    '--nav-rail-gradient': `linear-gradient(180deg, ${rgba(navTop, 0.98)} 0%, ${rgba(navBottom, 0.95)} 100%)`,
    '--dock-header-gradient': `linear-gradient(180deg, ${rgba(dockHeaderTop, 0.9)} 0%, ${rgba(dockHeaderBottom, 0.4)} 100%)`,
    '--shadow-accent-sm': `0 2px 12px ${rgba(deepRgb, 0.35)}`,
    '--shadow-accent-md': `0 4px 24px ${rgba(deepRgb, 0.45)}`,
    '--shadow-accent-lg': `0 4px 20px ${rgba(deepRgb, 0.35)}`,
    '--shadow-accent-xl': `0 8px 28px ${rgba(deepRgb, 0.45)}`,
    '--border-glow': rgba(accentRgb, 0.22),
    '--record-badge-bg': rgba(recordRgb, 0.14),
    '--record-badge-border': rgba(recordRgb, 0.35)
  }
}

export function buildCustomAccentVars(accentHex: string): Record<string, string> {
  const rgb = hexToRgb(accentHex)
  if (!rgb) return {}
  return {
    '--accent': accentHex,
    '--accent-hover': lighten(accentHex, 0.18),
    '--purple': lighten(accentHex, 0.12),
    '--purple-bright': accentHex,
    '--purple-deep': darken(accentHex, 0.28),
    '--record': accentHex
  }
}

export function applyAppTheme(themeId: AppThemeId, customAccent?: string): void {
  const preset = APP_THEME_PRESETS.find((t) => t.id === themeId) ?? APP_THEME_PRESETS[0]
  const root = document.documentElement
  root.dataset.theme = themeId

  const merged: Record<string, string> = { ...preset.vars }

  if (themeId === 'custom' && customAccent) {
    Object.assign(merged, buildCustomAccentVars(customAccent))
  }

  const allVars = { ...merged, ...buildDerivedThemeVars(merged) }

  for (const [key, value] of Object.entries(allVars)) {
    root.style.setProperty(key, value)
  }
}

export const DEFAULT_APP_THEME: AppThemeId = 'nova'
export const DEFAULT_CUSTOM_ACCENT = '#a78bfa'
