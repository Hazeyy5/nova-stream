export type VideoInputFormat = 'h264' | 'webm'
export type VideoChunkHandler = (chunk: Uint8Array) => void

interface StartOptions {
  canvas: HTMLCanvasElement
  framerate: number
  bitrateKbps: number
  onChunk: VideoChunkHandler
}

function pickWebmMimeType(): string {
  const types = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'
}

export class VideoPipeEncoder {
  private format: VideoInputFormat = 'webm'
  private encoder: VideoEncoder | null = null
  private mediaRecorder: MediaRecorder | null = null
  private framerate = 30
  private frameIndex = 0
  private onChunk: VideoChunkHandler | null = null

  getInputFormat(): VideoInputFormat {
    return this.format
  }

  async start(options: StartOptions): Promise<VideoInputFormat> {
    this.framerate = options.framerate
    this.onChunk = options.onChunk
    this.frameIndex = 0

    const { canvas, bitrateKbps } = options
    const width = canvas.width
    const height = canvas.height

    if (typeof VideoEncoder !== 'undefined' && width > 0 && height > 0) {
      const codec = 'avc1.42E01E'
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec,
          width,
          height,
          bitrate: bitrateKbps * 1000,
          framerate: options.framerate,
          avc: { format: 'annexb' }
        })
        if (support.supported) {
          await this.startWebCodecs(codec, width, height, bitrateKbps * 1000, options.framerate)
          this.format = 'h264'
          return this.format
        }
      } catch {
        /* fallback webm */
      }
    }

    this.startMediaRecorder(canvas, bitrateKbps)
    this.format = 'webm'
    return this.format
  }

  encodeFrame(canvas: HTMLCanvasElement): void {
    if (this.format !== 'h264' || !this.encoder || canvas.width <= 0 || canvas.height <= 0) return

    try {
      const timestamp = Math.round((this.frameIndex / this.framerate) * 1_000_000)
      const frame = new VideoFrame(canvas, { timestamp })
      this.encoder.encode(frame, { keyFrame: this.frameIndex % (this.framerate * 2) === 0 })
      frame.close()
      this.frameIndex++
    } catch {
      /* frame ignorée */
    }
  }

  async stop(): Promise<void> {
    const recorder = this.mediaRecorder
    this.mediaRecorder = null

    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()
        recorder.stop()
        setTimeout(resolve, 2000)
      })
    }

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

    this.onChunk = null
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
        if (!this.onChunk || chunk.byteLength === 0) return
        const copy = new Uint8Array(chunk.byteLength)
        chunk.copyTo(copy)
        this.onChunk(copy)
      },
      error: () => { /* ignoré */ }
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
          this.onChunk?.(new Uint8Array(buf))
        })
      }
    }

    recorder.start(250)
    this.mediaRecorder = recorder
  }
}
