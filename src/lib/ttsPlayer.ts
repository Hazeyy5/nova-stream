/** Lecture TTS via Web Speech API (Windows : voix Microsoft installées). */

export interface TtsSpeakOptions {
  voiceName?: string
  rate?: number
  pitch?: number
  volume?: number
}

let queue: string[] = []
let speaking = false

function pickVoice(preferred?: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  if (preferred) {
    const exact = voices.find((v) => v.name === preferred)
    if (exact) return exact
  }
  const fr = voices.find((v) => v.lang.startsWith('fr'))
  return fr ?? voices[0]
}

function speakOne(text: string, options: TtsSpeakOptions): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve()
      return
    }
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'fr-FR'
    const voice = pickVoice(options.voiceName)
    if (voice) utter.voice = voice
    utter.rate = Math.max(0.5, Math.min(2, options.rate ?? 1))
    utter.pitch = Math.max(0, Math.min(2, options.pitch ?? 1))
    utter.volume = Math.max(0, Math.min(1, (options.volume ?? 85) / 100))
    utter.onend = () => resolve()
    utter.onerror = () => resolve()
    window.speechSynthesis.speak(utter)
  })
}

async function drainQueue(options: TtsSpeakOptions): Promise<void> {
  if (speaking) return
  speaking = true
  while (queue.length > 0) {
    const next = queue.shift()
    if (next) await speakOne(next, options)
  }
  speaking = false
}

export function enqueueTtsSpeech(text: string, options: TtsSpeakOptions = {}): void {
  const cleaned = text.trim().slice(0, 280)
  if (!cleaned) return
  queue.push(cleaned)
  void drainQueue(options)
}

export function listTtsVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices() ?? []
}

export function testTts(options: TtsSpeakOptions = {}): void {
  enqueueTtsSpeech('Bonjour, ceci est un test Nova Stream.', options)
}

export function cancelTtsQueue(): void {
  queue = []
  window.speechSynthesis?.cancel()
  speaking = false
}

/** Précharge les voix (Chrome les charge de façon asynchrone). */
export function initTtsVoices(): void {
  if (!window.speechSynthesis) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices()
  }
}

export function filterTtsText(raw: string, blockedWords: string[]): string {
  let text = raw.replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim()
  for (const word of blockedWords) {
    if (!word.trim()) continue
    const re = new RegExp(word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    text = text.replace(re, '•••')
  }
  return text.slice(0, 280)
}
