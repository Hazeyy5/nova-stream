/** Voix TTS courantes sur Windows (Web Speech API / SAPI). */
export interface TtsVoicePreset {
  name: string
  label: string
  lang: string
}

export const WINDOWS_TTS_VOICE_PRESETS: TtsVoicePreset[] = [
  { name: 'Microsoft Denise Online (Natural) - French (France)', label: 'Denise (naturelle)', lang: 'fr-FR' },
  { name: 'Microsoft Henri Online (Natural) - French (France)', label: 'Henri (naturel)', lang: 'fr-FR' },
  { name: 'Microsoft Julie - French (France)', label: 'Julie', lang: 'fr-FR' },
  { name: 'Microsoft Paul - French (France)', label: 'Paul', lang: 'fr-FR' },
  { name: 'Microsoft Catherine - French (Canada)', label: 'Catherine (CA)', lang: 'fr-CA' },
  { name: 'Microsoft Sylvie Online (Natural) - French (Canada)', label: 'Sylvie (naturelle, CA)', lang: 'fr-CA' }
]

export function mergeTtsVoiceOptions(
  browserVoices: SpeechSynthesisVoice[],
  extraNames: string[] = []
): { name: string; label: string; lang: string; source: 'preset' | 'desktop' | 'browser' }[] {
  const seen = new Set<string>()
  const out: { name: string; label: string; lang: string; source: 'preset' | 'desktop' | 'browser' }[] = []

  const push = (name: string, label: string, lang: string, source: 'preset' | 'desktop' | 'browser') => {
    if (!name || seen.has(name)) return
    seen.add(name)
    out.push({ name, label, lang, source })
  }

  for (const p of WINDOWS_TTS_VOICE_PRESETS) {
    push(p.name, p.label, p.lang, 'preset')
  }
  for (const name of extraNames) {
    push(name, name, 'fr-FR', 'desktop')
  }
  const frBrowser = browserVoices.filter((v) => v.lang.startsWith('fr'))
  const list = frBrowser.length ? frBrowser : browserVoices
  for (const v of list) {
    push(v.name, `${v.name} (navigateur)`, v.lang, 'browser')
  }
  return out
}
