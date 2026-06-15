export type VideoInputFormat = 'h264' | 'webm'
export type VideoChunkHandler = (chunk: Uint8Array) => void

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

function pickWebmMimeType(): string {
  const types = [
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9',
    'video/webm;codecs=h264',
    'video/webm'
  ]
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'
}

export class VideoPipeEncoder {
  private format: VideoInputFormat = 'webm'
  private encoder: VideoEncoder | null = null
  private mediaRecorder: MediaRecorder | null = null
  private framerate = 30
  private frameIndex = 0
  private chunksEmitted = 0
  private onChunk: VideoChunkHandler | null = null
  private priming = false

  getInputFormat(): VideoInputFormat {
    return this.format
  }

  getLatencyEstimateMs(): number {
    return this.format === 'h264' ? 0 : 0
  }

  async start(options: StartOptions): Promise<VideoInputFormat> {
    this.framerate = options.framerate
    this.onChunk = options.onChunk
    this.frameIndex = 0
    this.chunksEmitted = 0
    this.priming = false

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
            avc: { format: 'annexb' }
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

    this.startMediaRecorder(canvas, bitrateKbps)
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

    try {
      const timestamp = Math.round((this.frameIndex / this.framerate) * 1_000_000)
      const frame = new VideoFrame(canvas, { timestamp })
      this.encoder.encode(frame, { keyFrame: this.frameIndex % Math.max(1, this.framerate) === 0 })
      frame.close()
      this.frameIndex++
    } catch {
      /* frame ignorée */
    }
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
    await this.stopMediaRecorder()
    await this.stopEncoderOnly()
    this.onChunk = null
    this.chunksEmitted = 0
    this.priming = false
  }

  private async stopMediaRecorder(): Promise<void> {
    const recorder = this.mediaRecorder
    this.mediaRecorder = null

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
        if (this.priming || !this.onChunk || chunk.byteLength === 0) return
        this.chunksEmitted += 1
        const copy = new Uint8Array(chunk.byteLength)
        chunk.copyTo(copy)
        this.onChunk(copy)
      },
      error: (err) => {
        console.error('[VideoPipeEncoder]', err)
      }
    })

    encoder.configure({
      codec,
      width,
      height,
      bitrate,
      framerate,
      avc: { format: 'annexb' }
    })

    this.encoder = encoder
  }

  private startMediaRecorder(canvas: HTMLCanvasElement, bitrateKbps: number): void {
    const mimeType = pickWebmMimeType()
    const stream = canvas.captureStream(this.framerate)
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrateKbps * 1000
    })

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.onChunk) {
        void event.data.arrayBuffer().then((buf) => {
          this.chunksEmitted += 1
          this.onChunk?.(new Uint8Array(buf))
        })
      }
    }

    recorder.start(250)
    this.mediaRecorder = recorder
  }
}
