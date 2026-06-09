export interface PcmFormat {
  isFloat?: boolean
  bitsPerChannel?: number
  channelsPerFrame?: number
}

export function levelFromPcmBuffer(
  buffer: Buffer,
  format: PcmFormat | null
): { peak: number; rms: number } {
  const isFloat = format?.isFloat ?? process.platform === 'win32'
  const bytesPerSample = isFloat ? 4 : Math.max(1, (format?.bitsPerChannel ?? 16) / 8)
  const sampleCount = Math.floor(buffer.length / bytesPerSample)

  if (sampleCount === 0) return { peak: 0, rms: 0 }

  let peak = 0
  let sumSq = 0

  if (isFloat) {
    for (let i = 0; i < sampleCount; i++) {
      const sample = buffer.readFloatLE(i * 4)
      const abs = Math.abs(sample)
      if (abs > peak) peak = abs
      sumSq += sample * sample
    }
  } else {
    for (let i = 0; i < sampleCount; i++) {
      const sample = buffer.readInt16LE(i * 2) / 32768
      const abs = Math.abs(sample)
      if (abs > peak) peak = abs
      sumSq += sample * sample
    }
  }

  return { peak, rms: Math.sqrt(sumSq / sampleCount) }
}

/** Seuil en dessous duquel le signal est considéré comme silence. */
export const PCM_NOISE_FLOOR = 0.003

export function applyNoiseFloor(level: number): number {
  return level < PCM_NOISE_FLOOR ? 0 : level
}
