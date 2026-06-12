export interface PcmInputFormat {
  isFloat?: boolean
  bitsPerChannel?: number
  channelsPerFrame?: number
}

/** Convertit un buffer PCM natif en s16le stéréo pour FFmpeg. */
export function pcmToS16le(buffer: Buffer, format: PcmInputFormat | null): Buffer {
  const isFloat = format?.isFloat ?? process.platform === 'win32'
  const bits = format?.bitsPerChannel ?? (isFloat ? 32 : 16)

  if (!isFloat && bits === 16) {
    return buffer
  }

  if (isFloat) {
    const samples = Math.floor(buffer.length / 4)
    const out = Buffer.alloc(samples * 2)
    for (let i = 0; i < samples; i++) {
      const f = Math.max(-1, Math.min(1, buffer.readFloatLE(i * 4)))
      out.writeInt16LE(Math.round(f * 32767), i * 2)
    }
    return out
  }

  if (bits === 32) {
    const samples = Math.floor(buffer.length / 4)
    const out = Buffer.alloc(samples * 2)
    for (let i = 0; i < samples; i++) {
      const sample = buffer.readInt32LE(i * 4) / 2147483648
      const clamped = Math.max(-1, Math.min(1, sample))
      out.writeInt16LE(Math.round(clamped * 32767), i * 2)
    }
    return out
  }

  return buffer
}
