import { recommendBitrate, type BitrateRecommendation } from '../../shared/bitrateRecommendation'

const UPLOAD_URL = 'https://speed.cloudflare.com/__up'
const CHUNK_SIZE = 1_048_576
const TEST_DURATION_MS = 5000
const WARMUP_BYTES = 262_144

export interface SpeedtestResult extends BitrateRecommendation {}

async function uploadChunk(body: Buffer | Uint8Array): Promise<void> {
  const res = await fetch(UPLOAD_URL, { method: 'POST', body })
  if (!res.ok) throw new Error('Échec du test de débit')
}

export async function runUploadSpeedtest(
  onProgress: (percent: number) => void
): Promise<number> {
  const chunk = Buffer.alloc(CHUNK_SIZE)
  await uploadChunk(chunk.subarray(0, WARMUP_BYTES))

  let totalBytes = 0
  const start = Date.now()

  while (Date.now() - start < TEST_DURATION_MS) {
    await uploadChunk(chunk)
    totalBytes += CHUNK_SIZE
    const elapsed = Date.now() - start
    onProgress(Math.min(99, Math.round((elapsed / TEST_DURATION_MS) * 100)))
  }

  const elapsedSec = (Date.now() - start) / 1000
  onProgress(100)
  return (totalBytes * 8) / (elapsedSec * 1_000_000)
}

export async function runSpeedtest(
  resolution: string,
  framerate: number,
  audioBitrate: number,
  onProgress: (percent: number) => void
): Promise<SpeedtestResult> {
  const uploadMbps = await runUploadSpeedtest(onProgress)
  return recommendBitrate(uploadMbps, resolution, framerate, audioBitrate)
}
