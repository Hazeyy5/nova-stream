import type { SceneCollection, Source, SourceTransform } from '../types'
import { resolveVideoDeviceId } from './videoDeviceResolver'

export type WebcamSlotAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'

export interface WebcamLayoutContext {
  camWidth: number
  camHeight: number
  canvasWidth: number
  canvasHeight: number
}

/** Sonde la résolution native de la webcam (settings ou caméra par défaut). */
export async function probeWebcamResolution(deviceName?: string): Promise<{ width: number; height: number } | null> {
  try {
    const deviceId = deviceName?.trim()
      ? await resolveVideoDeviceId(deviceName.trim())
      : undefined

    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false
    })

    const track = stream.getVideoTracks()[0]
    const trackSettings = track?.getSettings()
    let width = trackSettings?.width ?? 0
    let height = trackSettings?.height ?? 0

    if (!width || !height) {
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      await video.play()
      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0) {
          resolve()
          return
        }
        video.onloadedmetadata = () => resolve()
        setTimeout(resolve, 2500)
      })
      width = video.videoWidth
      height = video.videoHeight
    }

    stream.getTracks().forEach((t) => t.stop())

    if (width > 0 && height > 0) {
      return { width, height }
    }
  } catch {
    /* permission refusée ou pas de caméra */
  }
  return null
}

/** Ajuste un emplacement % pour contenir la webcam sans déformation (mode fit). */
export function fitWebcamToSlot(
  slot: SourceTransform,
  anchor: WebcamSlotAnchor,
  ctx: WebcamLayoutContext
): SourceTransform {
  const { camWidth, camHeight, canvasWidth, canvasHeight } = ctx
  if (camWidth <= 0 || camHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
    return slot
  }

  const slotPxW = (slot.width / 100) * canvasWidth
  const slotPxH = (slot.height / 100) * canvasHeight
  const slotLeft = (slot.x / 100) * canvasWidth
  const slotTop = (slot.y / 100) * canvasHeight
  const slotRight = slotLeft + slotPxW
  const slotBottom = slotTop + slotPxH

  const camAspect = camWidth / camHeight
  const slotAspect = slotPxW / slotPxH

  let fitW: number
  let fitH: number
  if (camAspect > slotAspect) {
    fitW = slotPxW
    fitH = slotPxW / camAspect
  } else {
    fitH = slotPxH
    fitW = slotPxH * camAspect
  }

  let left: number
  let top: number
  switch (anchor) {
    case 'top-right':
      left = slotRight - fitW
      top = slotTop
      break
    case 'bottom-left':
      left = slotLeft
      top = slotBottom - fitH
      break
    case 'bottom-right':
      left = slotRight - fitW
      top = slotBottom - fitH
      break
    case 'center':
      left = slotLeft + (slotPxW - fitW) / 2
      top = slotTop + (slotPxH - fitH) / 2
      break
    case 'top-left':
    default:
      left = slotLeft
      top = slotTop
      break
  }

  return {
    ...slot,
    x: Math.max(0, (left / canvasWidth) * 100),
    y: Math.max(0, (top / canvasHeight) * 100),
    width: Math.min(100, (fitW / canvasWidth) * 100),
    height: Math.min(100, (fitH / canvasHeight) * 100)
  }
}

export function adaptWebcamSource(
  source: Source,
  anchor: WebcamSlotAnchor,
  ctx: WebcamLayoutContext
): Source {
  if (source.type !== 'webcam') return source
  return {
    ...source,
    scaleMode: source.scaleMode === 'fill' ? 'fill' : 'fit',
    transform: fitWebcamToSlot(source.transform, anchor, ctx)
  }
}

export function adaptCollectionWebcamLayouts(
  collection: SceneCollection,
  anchorsByScene: Record<string, Record<string, WebcamSlotAnchor>>,
  ctx: WebcamLayoutContext
): SceneCollection {
  return {
    ...collection,
    scenes: collection.scenes.map((scene) => ({
      ...scene,
      sources: scene.sources.map((source) => {
        const anchor = anchorsByScene[scene.name]?.[source.name]
        if (!anchor || source.type !== 'webcam') return source
        return adaptWebcamSource(source, anchor, ctx)
      })
    }))
  }
}
