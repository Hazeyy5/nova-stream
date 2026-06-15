import { app } from 'electron'
import ffmpegStaticPath from 'ffmpeg-static'

/** Chemin exécutable FFmpeg — compatible dev et build packagé (binaire hors asar). */
export function resolveFfmpegPath(): string | null {
  const bundled = ffmpegStaticPath
  if (!bundled) return null
  if (!app.isPackaged) return bundled
  if (bundled.includes('app.asar')) {
    return bundled.replace('app.asar', 'app.asar.unpacked')
  }
  return bundled
}
