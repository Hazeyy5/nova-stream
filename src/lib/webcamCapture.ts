import { resolveVideoDeviceId } from './videoDeviceResolver'

/** Contraintes basse latence — évite 720p/4K natif qui tamponne ~1 s dans Chromium. */
export function buildWebcamVideoConstraints(deviceId?: string): MediaTrackConstraints {
  const video: MediaTrackConstraints = {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 30, max: 30 }
  }
  if (deviceId) video.deviceId = { exact: deviceId }
  return video
}

export async function applyWebcamLowLatency(track: MediaStreamTrack): Promise<void> {
  try {
    track.contentHint = 'motion'
    await track.applyConstraints(buildWebcamVideoConstraints())
  } catch {
    /* contraintes optionnelles */
  }
  try {
    await track.applyConstraints({
      advanced: [{ latency: 0.033 } as MediaTrackConstraintSet]
    })
  } catch {
    /* hint Chromium optionnel */
  }
}

export async function openWebcamStream(deviceName?: string): Promise<MediaStream> {
  const deviceId = deviceName?.trim()
    ? await resolveVideoDeviceId(deviceName.trim())
    : undefined

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: buildWebcamVideoConstraints(deviceId)
  })

  const track = stream.getVideoTracks()[0]
  if (track) await applyWebcamLowLatency(track)
  return stream
}

export function createWebcamImageCapture(stream: MediaStream): ImageCapture | null {
  const track = stream.getVideoTracks()[0]
  if (!track || typeof ImageCapture === 'undefined') return null
  try {
    return new ImageCapture(track)
  } catch {
    return null
  }
}

export function configureWebcamVideoElement(video: HTMLVideoElement): void {
  video.muted = true
  video.playsInline = true
  video.autoplay = true
  video.disablePictureInPicture = true
}
