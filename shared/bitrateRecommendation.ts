export interface BitrateRecommendation {
  uploadMbps: number
  recommendedVideoBitrate: number
  platformMaxKbps: number
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  message: string
}

const PLATFORM_MAX_KBPS: Record<string, number> = {
  '1920x1080-30': 6000,
  '1920x1080-60': 8000,
  '1280x720-30': 4500,
  '1280x720-60': 6000,
  '2560x1440-30': 9000,
  '2560x1440-60': 12000,
  '854x480-30': 2500,
  '854x480-60': 3500
}

const MIN_UPLOAD_MBPS: Record<string, number> = {
  '1920x1080-30': 5,
  '1920x1080-60': 8,
  '1280x720-30': 3,
  '1280x720-60': 5,
  '2560x1440-30': 8,
  '2560x1440-60': 12,
  '854x480-30': 2,
  '854x480-60': 3
}

function roundToStep(value: number, step = 250): number {
  return Math.round(value / step) * step
}

export function recommendBitrate(
  uploadMbps: number,
  resolution: string,
  framerate: number,
  audioBitrate: number
): BitrateRecommendation {
  const key = `${resolution}-${framerate}`
  const platformMaxKbps = PLATFORM_MAX_KBPS[key] ?? 4500
  const minUploadMbps = MIN_UPLOAD_MBPS[key] ?? 3

  const usableKbps = uploadMbps * 1000 * 0.7
  const fromSpeed = usableKbps - audioBitrate - 300
  const recommendedVideoBitrate = Math.max(
    800,
    Math.min(platformMaxKbps, roundToStep(fromSpeed))
  )

  const ratio = uploadMbps / minUploadMbps
  let quality: BitrateRecommendation['quality']
  let message: string

  if (ratio >= 1.5) {
    quality = 'excellent'
    message = `Connexion solide pour ${resolution} à ${framerate} fps.`
  } else if (ratio >= 1.1) {
    quality = 'good'
    message = `Connexion adaptée pour ${resolution} à ${framerate} fps.`
  } else if (ratio >= 0.85) {
    quality = 'fair'
    message = `Connexion limite — envisagez une résolution inférieure si des pertes apparaissent.`
  } else {
    quality = 'poor'
    message = `Connexion insuffisante pour ${resolution} à ${framerate} fps — baissez la résolution ou le FPS.`
  }

  return {
    uploadMbps: Math.round(uploadMbps * 10) / 10,
    recommendedVideoBitrate,
    platformMaxKbps,
    quality,
    message
  }
}
