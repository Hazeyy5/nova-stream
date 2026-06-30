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
  '--accent-dim': 'rgba(167, 139, 250, 0.5)',
  '--accent-bg': 'rgba(139, 92, 246, 0.14)',
  '--accent-glow': 'rgba(167, 139, 250, 0.4)',
  '--purple': '#c4b5fd',
  '--purple-bright': '#a78bfa',
  '--purple-deep': '#7c3aed',
  '--border-glow': 'rgba(167, 139, 250, 0.22)'
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
      '--accent-dim': 'rgba(148, 163, 184, 0.45)',
      '--accent-bg': 'rgba(148, 163, 184, 0.1)',
      '--accent-glow': 'rgba(148, 163, 184, 0.25)',
      '--purple': '#cbd5e1',
      '--purple-bright': '#94a3b8',
      '--purple-deep': '#64748b',
      '--border-glow': 'rgba(148, 163, 184, 0.15)'
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
      '--accent-dim': 'rgba(56, 189, 248, 0.45)',
      '--accent-bg': 'rgba(14, 165, 233, 0.14)',
      '--accent-glow': 'rgba(56, 189, 248, 0.35)',
      '--purple': '#7dd3fc',
      '--purple-bright': '#38bdf8',
      '--purple-deep': '#0284c7',
      '--border-glow': 'rgba(56, 189, 248, 0.22)',
      '--record': '#38bdf8'
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
      '--accent-dim': 'rgba(52, 211, 153, 0.45)',
      '--accent-bg': 'rgba(16, 185, 129, 0.12)',
      '--accent-glow': 'rgba(52, 211, 153, 0.35)',
      '--purple': '#6ee7b7',
      '--purple-bright': '#34d399',
      '--purple-deep': '#059669',
      '--border-glow': 'rgba(52, 211, 153, 0.2)',
      '--record': '#34d399'
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

export function buildCustomAccentVars(accentHex: string): Record<string, string> {
  const rgb = hexToRgb(accentHex)
  if (!rgb) return {}
  const { r, g, b } = rgb
  return {
    '--accent': accentHex,
    '--accent-hover': accentHex,
    '--accent-dim': `rgba(${r}, ${g}, ${b}, 0.5)`,
    '--accent-bg': `rgba(${r}, ${g}, ${b}, 0.14)`,
    '--accent-glow': `rgba(${r}, ${g}, ${b}, 0.38)`,
    '--purple': accentHex,
    '--purple-bright': accentHex,
    '--border-glow': `rgba(${r}, ${g}, ${b}, 0.22)`,
    '--record': accentHex
  }
}

export function applyAppTheme(themeId: AppThemeId, customAccent?: string): void {
  const preset = APP_THEME_PRESETS.find((t) => t.id === themeId) ?? APP_THEME_PRESETS[0]
  const root = document.documentElement
  root.dataset.theme = themeId

  for (const [key, value] of Object.entries(preset.vars)) {
    root.style.setProperty(key, value)
  }

  if (themeId === 'custom' && customAccent) {
    for (const [key, value] of Object.entries(buildCustomAccentVars(customAccent))) {
      root.style.setProperty(key, value)
    }
  }
}

export const DEFAULT_APP_THEME: AppThemeId = 'nova'
export const DEFAULT_CUSTOM_ACCENT = '#a78bfa'
