export type VideoInputFormat = 'h264' | 'webm'
export type VideoChunkMeta = { durationMs: number }
export type VideoChunkHandler = (chunk: Uint8Array, meta: VideoChunkMeta) => void

interface StartOptions {
  canvas: HTMLCanvasElement
  framerate: number
  bitrateKbps: number
  onChunk: VideoChunkHandler
}

const H264_CODEC_CANDIDATES = [
  'avc1.42E01E',
  'avc1.4D401F',
  'avc1.640028'
]

export const WEBM_CHUNK_DURATION_MS = 66

function pickWebmMimeType(): string {
  const types = [
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9',
    'video/webm;codecs=h264',
    'video/webm'
  ]
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'
}

function mergeChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

export class VideoPipeEncoder {
  private format: VideoInputFormat = 'webm'
  private encoder: VideoEncoder | null = null
  private mediaRecorder: MediaRecorder | null = null
  private captureTrack: CanvasCaptureMediaStreamTrack | null = null
  private framerate = 30
  private frameIndex = 0
  private sessionStartUs: number | null = null
  private chunksEmitted = 0
  private onChunk: VideoChunkHandler | null = null
  private priming = false
  private encodeQueue: HTMLCanvasElement[] = []
  private encodingH264 = false
  private h264FrameChunks: Uint8Array[] = []
  private h264FrameResolve: (() => void) | null = null

  getInputFormat(): VideoInputFormat {
    return this.format
  }

  getLatencyEstimateMs(): number {
    return 0
  }

  setOnChunk(handler: VideoChunkHandler | null): void {
    this.onChunk = handler
  }

  /** Démarre l'envoi des chunks (après que le muxer FFmpeg soit prêt). */
  beginCapture(onChunk: VideoChunkHandler, canvas: HTMLCanvasElement, bitrateKbps: number): void {
    this.onChunk = onChunk
    this.sessionStartUs = null
    this.frameIndex = 0
    if (this.format === 'webm' && !this.mediaRecorder) {
      this.startMediaRecorder(canvas, bitrateKbps)
    }
  }

  /** WebM : pousse une frame canvas vers MediaRecorder (aligné sur la boucle de dessin). */
  requestFrame(): void {
    try {
      this.captureTrack?.requestFrame()
    } catch {
      /* frame ignorée */
    }
  }

  async start(options: StartOptions): Promise<VideoInputFormat> {
    this.framerate = options.framerate
    this.onChunk = options.onChunk
    this.frameIndex = 0
    this.chunksEmitted = 0
    this.priming = false
    this.sessionStartUs = null
    this.encodeQueue = []
    this.encodingH264 = false

    const { canvas, bitrateKbps } = options
    const width = canvas.width
    const height = canvas.height

    if (typeof VideoEncoder !== 'undefined' && width > 0 && height > 0) {
      for (const codec of H264_CODEC_CANDIDATES) {
        try {
          const support = await VideoEncoder.isConfigSupported({
            codec,
            width,
            height,
            bitrate: bitrateKbps * 1000,
            framerate: options.framerate,
            avc: { format: 'annexb' },
            latencyMode: 'realtime'
          })
          if (!support.supported) continue
          await this.startWebCodecs(codec, width, height, bitrateKbps * 1000, options.framerate)
          this.format = 'h264'
          this.prime(canvas, 8)
          const hasChunks = await this.waitForChunks(2, 3500)
          if (hasChunks) return this.format
          console.warn('[VideoPipeEncoder] H264 sans sortie — repli WebM')
          await this.stopEncoderOnly()
        } catch {
          await this.stopEncoderOnly()
        }
      }
    }

    this.format = 'webm'
    return this.format
  }

  async waitForChunks(min: number, timeoutMs: number): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (this.chunksEmitted >= min) return true
      await new Promise((resolve) => setTimeout(resolve, 40))
    }
    return this.chunksEmitted >= min
  }

  encodeFrame(canvas: HTMLCanvasElement): void {
    if (this.format !== 'h264' || !this.encoder || canvas.width <= 0 || canvas.height <= 0) return
    this.encodeQueue.push(canvas)
    void this.drainH264Queue()
  }

  prime(canvas: HTMLCanvasElement, frames = 4): void {
    if (this.format !== 'h264') return
    this.priming = true
    for (let i = 0; i < frames; i++) {
      this.encodeFrame(canvas)
    }
    this.priming = false
  }

  async stop(): Promise<void> {
    await this.drainH264Queue()
    await this.stopMediaRecorder()
    await this.stopEncoderOnly()
    this.onChunk = null
    this.chunksEmitted = 0
    this.priming = false
    this.encodeQueue = []
  }

  private frameDurationMs(): number {
    return 1000 / Math.max(1, this.framerate)
  }

  private async drainH264Queue(): Promise<void> {
    if (this.encodingH264 || !this.encoder) return
    this.encodingH264 = true

    while (this.encodeQueue.length > 0) {
      const canvas = this.encodeQueue.shift()!
      await this.encodeOneH264Frame(canvas)
      if (!this.priming) {
        this.emitH264Frame()
      }
    }

    this.encodingH264 = false
  }

  private async encodeOneH264Frame(canvas: HTMLCanvasElement): Promise<void> {
    if (!this.encoder) return

    const nowUs = Math.round(performance.now() * 1000)
    if (this.sessionStartUs === null) {
      this.sessionStartUs = nowUs
    }
    const timestamp = nowUs - this.sessionStartUs

    let frame: VideoFrame | null = null
    try {
      frame = new VideoFrame(canvas, { timestamp })
      this.h264FrameChunks = []

      await new Promise<void>((resolve) => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          this.h264FrameResolve = null
          resolve()
        }

        this.h264FrameResolve = finish
        this.encoder!.encode(frame!, { keyFrame: this.frameIndex % Math.max(1, this.framerate) === 0 })
        this.frameIndex++

        setTimeout(finish, 48)
      })
    } catch {
      this.h264FrameResolve?.()
      this.h264FrameResolve = null
    } finally {
      frame?.close()
    }
  }

  private emitH264Frame(): void {
    if (!this.onChunk || this.h264FrameChunks.length === 0) return
    const merged = mergeChunks(this.h264FrameChunks)
    this.h264FrameChunks = []
    if (merged.byteLength === 0) return
    this.chunksEmitted += 1
    this.onChunk(merged, { durationMs: this.frameDurationMs() })
  }

  private async stopMediaRecorder(): Promise<void> {
    const recorder = this.mediaRecorder
    this.mediaRecorder = null
    this.captureTrack = null

    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()
        recorder.stop()
        setTimeout(resolve, 2000)
      })
    }
  }

  private async stopEncoderOnly(): Promise<void> {
    const encoder = this.encoder
    this.encoder = null

    if (encoder && encoder.state !== 'closed') {
      try {
        if (encoder.state === 'configured') {
          await encoder.flush()
        }
        encoder.close()
      } catch {
        try { encoder.close() } catch { /* ignore */ }
      }
    }
  }

  private async startWebCodecs(
    codec: string,
    width: number,
    height: number,
    bitrate: number,
    framerate: number
  ): Promise<void> {
    const encoder = new VideoEncoder({
      output: (chunk) => {
        if (chunk.byteLength === 0) return
        const copy = new Uint8Array(chunk.byteLength)
        chunk.copyTo(copy)
        this.h264FrameChunks.push(copy)
        this.h264FrameResolve?.()
      },
      error: (err) => {
        console.error('[VideoPipeEncoder]', err)
        this.h264FrameResolve?.()
      }
    })

    encoder.configure({
      codec,
      width,
      height,
      bitrate,
      framerate,
      avc: { format: 'annexb' },
      latencyMode: 'realtime'
    })

    this.encoder = encoder
  }

  private startMediaRecorder(canvas: HTMLCanvasElement, bitrateKbps: number): void {
    const mimeType = pickWebmMimeType()
    const stream = canvas.captureStream(0)
    this.captureTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrateKbps * 1000
    })

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.onChunk) {
        void event.data.arrayBuffer().then((buf) => {
          this.chunksEmitted += 1
          this.onChunk?.(new Uint8Array(buf), { durationMs: WEBM_CHUNK_DURATION_MS })
        })
      }
    }

    recorder.start(WEBM_CHUNK_DURATION_MS)
    this.mediaRecorder = recorder
  }
}
