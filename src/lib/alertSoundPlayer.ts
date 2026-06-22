import type { AlertType } from '../types'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

function playTone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function playDefaultSound(type: AlertType, volumeNorm: number): void {
  const ctx = getAudioContext()
  const t0 = ctx.currentTime
  const v = Math.max(0.05, Math.min(1, volumeNorm))

  switch (type) {
    case 'follow':
      playTone(ctx, 523.25, t0, 0.12, v * 0.35)
      playTone(ctx, 659.25, t0 + 0.1, 0.14, v * 0.38)
      playTone(ctx, 783.99, t0 + 0.22, 0.18, v * 0.42)
      break
    case 'sub':
      playTone(ctx, 440, t0, 0.1, v * 0.32, 'triangle')
      playTone(ctx, 554.37, t0 + 0.08, 0.1, v * 0.34, 'triangle')
      playTone(ctx, 659.25, t0 + 0.16, 0.12, v * 0.36, 'triangle')
      playTone(ctx, 880, t0 + 0.28, 0.22, v * 0.4, 'sine')
      break
    case 'donation':
      playTone(ctx, 988, t0, 0.06, v * 0.45, 'square')
      playTone(ctx, 1318.5, t0 + 0.07, 0.08, v * 0.4, 'square')
      playTone(ctx, 1568, t0 + 0.14, 0.14, v * 0.38, 'sine')
      break
    case 'raid':
      playTone(ctx, 220, t0, 0.2, v * 0.42, 'sawtooth')
      playTone(ctx, 330, t0 + 0.12, 0.18, v * 0.38, 'sawtooth')
      playTone(ctx, 440, t0 + 0.26, 0.24, v * 0.45, 'triangle')
      break
  }
}

const customAudioCache = new Map<string, HTMLAudioElement>()

function playCustomSound(url: string, volumeNorm: number): void {
  let audio = customAudioCache.get(url)
  if (!audio) {
    audio = new Audio(url)
    audio.preload = 'auto'
    customAudioCache.set(url, audio)
  }
  audio.volume = Math.max(0, Math.min(1, volumeNorm))
  audio.currentTime = 0
  void audio.play().catch(() => {
    /* autoplay ou URL invalide — ignoré */
  })
}

export interface AlertSoundOptions {
  volume?: number
  customUrl?: string
}

export function playAlertSound(type: AlertType, options: AlertSoundOptions = {}): void {
  const volumeNorm = Math.max(0, Math.min(100, options.volume ?? 80)) / 100
  const customUrl = options.customUrl?.trim()
  if (customUrl) {
    playCustomSound(customUrl, volumeNorm)
    return
  }
  playDefaultSound(type, volumeNorm)
}
