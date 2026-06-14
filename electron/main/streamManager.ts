import { spawn, type ChildProcessWithoutNullStreams, type Writable } from 'child_process'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import ffmpegPath from 'ffmpeg-static'
import { buildFfmpegScenePipeArgs, buildRtmpUrl, resolveRecordingFilePath, parseFfmpegError, isAudioStartupError } from './ffmpegBuilder'
import { listMediaDevices, listDshowMediaDevices, resolveStreamSettings } from './deviceManager'
import { DesktopAudioCapture } from './desktopAudioCapture'
import { StreamMeterParser, streamAudioMeterService } from './streamMeterParser'
import type { MediaState, StreamSettings } from '../../src/types'

export interface StartMediaOptions {
  settings: StreamSettings
  stream?: boolean
  record?: boolean
  videoInputFormat?: 'h264' | 'webm'
}

export class StreamManager {
  private process: ChildProcessWithoutNullStreams | null = null
  private pendingChunks: Buffer[] = []
  private desktopCapture = new DesktopAudioCapture()
  private sessionSettings: StreamSettings | null = null
  private sessionOptions: {
    stream: boolean
    record: boolean
    videoInputFormat: 'h264' | 'webm'
  } | null = null
  private audioRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private refreshingAudio = false
  private sessionUsesNativeDesktop = false
  private nativeDesktopPipe: Writable | null = null
  private nativeDesktopStarted = false
  private state: MediaState = {
    stream: { status: 'idle' },
    recording: { status: 'idle' }
  }
  private onStateChange?: (state: MediaState) => void

  setOnStateChange(callback: (state: MediaState) => void): void {
    this.onStateChange = callback
  }

  getState(): MediaState {
    return {
      stream: { ...this.state.stream },
      recording: { ...this.state.recording }
    }
  }

  private setState(partial: Partial<MediaState>): void {
    this.state = {
      stream: { ...this.state.stream, ...partial.stream },
      recording: { ...this.state.recording, ...partial.recording }
    }
    this.onStateChange?.(this.getState())
  }

  private flushPendingChunks(): void {
    if (this.pendingChunks.length > 0) {
      this.startNativeDesktopCaptureIfNeeded()
    }
    const stdin = this.process?.stdin
    if (!stdin || stdin.destroyed || !stdin.writable) return
    for (const chunk of this.pendingChunks) stdin.write(chunk)
    this.pendingChunks = []
  }

  handleVideoChunk(chunk: Buffer): void {
    if (chunk.length > 0) {
      this.startNativeDesktopCaptureIfNeeded()
    }

    const stdin = this.process?.stdin
    if (!stdin || stdin.destroyed || !stdin.writable) {
      this.pendingChunks.push(chunk)
      if (this.pendingChunks.length > 120) this.pendingChunks.shift()
      return
    }
    this.flushPendingChunks()
    stdin.write(chunk)
  }

  private startNativeDesktopCaptureIfNeeded(): void {
    if (!this.sessionUsesNativeDesktop || this.nativeDesktopStarted) return
    this.nativeDesktopStarted = true

    const desktopPipe = this.nativeDesktopPipe
    desktopPipe?.on('error', () => { /* pipe fermé à l'arrêt */ })
    void this.desktopCapture.start((pcmChunk) => {
      if (desktopPipe && !desktopPipe.destroyed && desktopPipe.writable) {
        desktopPipe.write(pcmChunk)
      }
    }).catch(() => { /* capture bureau optionnelle */ })
  }

  async start(options: StartMediaOptions): Promise<void> {
    if (this.process) throw new Error('Une session média est déjà active')
    if (!ffmpegPath) throw new Error('FFmpeg introuvable')

    const { settings, stream = false, record = false, videoInputFormat = 'webm' } = options
    if (!stream && !record) throw new Error('Aucune sortie sélectionnée')

    this.sessionSettings = settings
    this.sessionOptions = { stream, record, videoInputFormat }

    const [devices, dshowDevices] = await Promise.all([
      listMediaDevices(),
      listDshowMediaDevices()
    ])
    let resolved = resolveStreamSettings(settings, devices, dshowDevices)

    const wantsAudio = stream || (
      record &&
      resolved.recordAudioEnabled &&
      (resolved.audioEnabled || resolved.desktopAudioEnabled)
    )

    let audioWarning: string | undefined

    try {
      await this.launchFfmpeg({
        resolved,
        stream,
        record,
        videoInputFormat,
        includeAudio: wantsAudio
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!wantsAudio || !isAudioStartupError(message)) throw err

      resolved = {
        ...resolved,
        audioEnabled: false,
        desktopAudioEnabled: false,
        desktopAudioBackend: undefined,
        desktopAudioCaptureDevice: ''
      }
      audioWarning = 'Audio indisponible — diffusion sans son. Vérifiez Paramètres → Audio.'
      await this.launchFfmpeg({
        resolved,
        stream,
        record,
        videoInputFormat,
        includeAudio: false
      })
    }

    if (audioWarning && stream) {
      this.setState({
        stream: {
          ...this.state.stream,
          status: 'live',
          message: audioWarning,
          startedAt: this.state.stream.startedAt ?? Date.now()
        }
      })
    }
  }

  updateAudioSettings(settings: StreamSettings): void {
    if (!this.process || !this.sessionOptions) return
    this.sessionSettings = settings
    if (this.audioRefreshTimer) clearTimeout(this.audioRefreshTimer)
    this.audioRefreshTimer = setTimeout(() => {
      void this.refreshAudioPipeline()
    }, 400)
  }

  private async refreshAudioPipeline(): Promise<void> {
    if (!this.process || !this.sessionOptions || !this.sessionSettings || this.refreshingAudio) return

    this.refreshingAudio = true
    const wasLive = this.state.stream.status === 'live'
    const wasRecording = this.state.recording.status === 'recording'
    const streamStartedAt = this.state.stream.startedAt
    const recordStartedAt = this.state.recording.startedAt
    const recordPath = this.state.recording.filePath
    const liveMessage = this.state.stream.message

    const proc = this.process
    this.process = null
    this.nativeDesktopStarted = false
    this.nativeDesktopPipe = null
    await this.desktopCapture.stop()
    try { proc.stdin.end() } catch { /* ignore */ }
    try { proc.kill('SIGKILL') } catch { /* ignore */ }

    streamAudioMeterService.reset()

    const [devices, dshowDevices] = await Promise.all([
      listMediaDevices(),
      listDshowMediaDevices()
    ])
    let resolved = resolveStreamSettings(this.sessionSettings, devices, dshowDevices)

    const wantsAudio = this.sessionOptions.stream || (
      this.sessionOptions.record &&
      resolved.recordAudioEnabled &&
      (resolved.audioEnabled || resolved.desktopAudioEnabled)
    )

    try {
      await this.launchFfmpeg({
        resolved,
        stream: this.sessionOptions.stream,
        record: this.sessionOptions.record,
        videoInputFormat: this.sessionOptions.videoInputFormat,
        includeAudio: wantsAudio,
        quiet: true
      })
    } catch {
      this.setState({
        stream: { status: 'error', message: 'Impossible de mettre à jour l\'audio en direct' },
        recording: { status: 'idle' }
      })
      this.sessionSettings = null
      this.sessionOptions = null
      this.refreshingAudio = false
      return
    }

    if (wasLive) {
      this.setState({
        stream: {
          status: 'live',
          message: liveMessage ?? 'En direct',
          startedAt: streamStartedAt ?? Date.now()
        }
      })
    }
    if (wasRecording) {
      this.setState({
        recording: {
          status: 'recording',
          filePath: recordPath,
          startedAt: recordStartedAt ?? Date.now()
        }
      })
    }

    this.refreshingAudio = false
  }

  private launchFfmpeg(options: {
    resolved: StreamSettings
    stream: boolean
    record: boolean
    videoInputFormat: 'h264' | 'webm'
    includeAudio: boolean
    quiet?: boolean
  }): Promise<void> {
    const { resolved, stream, record, videoInputFormat, includeAudio, quiet = false } = options

    let recordPath: string | undefined
    if (record) {
      recordPath = resolveRecordingFilePath(resolved.recordingPath)
      mkdirSync(dirname(recordPath), { recursive: true })
    }

    const rtmpUrl = stream ? buildRtmpUrl(resolved) : undefined
    const { args, usesNativeDesktop, meterChannels } = buildFfmpegScenePipeArgs(resolved, {
      rtmpUrl,
      recordPath,
      includeAudio,
      videoInputFormat
    })
    const meterParser = new StreamMeterParser(meterChannels)

    if (stream && !quiet) {
      this.setState({ stream: { status: 'starting', message: 'Connexion au serveur...' } })
    }
    if (record && !quiet) {
      this.setState({
        recording: { status: 'recording', filePath: recordPath, startedAt: Date.now() }
      })
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath!, args, {
        windowsHide: true,
        stdio: usesNativeDesktop ? ['pipe', 'pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
      })
      this.process = proc
      this.pendingChunks = []
      this.sessionUsesNativeDesktop = usesNativeDesktop
      this.nativeDesktopPipe = usesNativeDesktop ? (proc.stdio[3] as Writable | null) : null
      this.nativeDesktopStarted = false

      if (usesNativeDesktop) {
        this.nativeDesktopPipe?.on('error', () => { /* pipe fermé à l'arrêt */ })
      }

      let stderr = ''
      let started = false
      let rejected = false

      const fail = (message: string) => {
        if (rejected) return
        rejected = true
        this.process = null
        void this.desktopCapture.stop()
        try { proc.stdin.end() } catch { /* ignore */ }
        try { proc.kill('SIGKILL') } catch { /* ignore */ }
        this.setState({
          stream: { status: 'error', message },
          recording: { status: 'idle' }
        })
        reject(new Error(message))
      }

      const markStarted = () => {
        if (started) return
        started = true
        if (stream) {
          this.setState({
            stream: { status: 'live', message: 'En direct', startedAt: Date.now() }
          })
        }
        resolve()
      }

      proc.on('spawn', () => {
        this.flushPendingChunks()
        if (record && !stream) markStarted()
      })

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()

        const meterUpdates = meterParser.parseChunk(chunk.toString())
        if (meterUpdates) streamAudioMeterService.push(meterUpdates)

        const audioInputError =
          stderr.includes('Could not find audio device') ||
          stderr.includes('Could not find audio only device') ||
          stderr.includes('Error opening input file audio=') ||
          (stderr.includes('Error opening input') && includeAudio)

        if (!started && audioInputError) {
          fail(parseFfmpegError(stderr))
          return
        }

        if (!started && (stderr.includes('frame=') || stderr.includes('Output #0') || stderr.includes('rtmp://'))) {
          markStarted()
        }
      })

      proc.stdin.on('error', () => { /* pipe fermé à l'arrêt */ })

      proc.on('error', (err) => {
        fail(err.message)
      })

      proc.on('close', (code) => {
        this.process = null
        this.pendingChunks = []
        const stopping = this.state.stream.status === 'stopping'

        if (!started && !rejected) {
          fail(parseFfmpegError(stderr))
          return
        }

        if (code !== 0 && code !== null && !stopping && !rejected) {
          const message = parseFfmpegError(stderr)
          this.setState({
            stream: { status: 'error', message },
            recording: { status: 'idle' }
          })
        } else if (!rejected) {
          this.setState({
            stream: { status: 'idle', message: undefined, startedAt: undefined },
            recording: { status: 'idle', filePath: undefined, startedAt: undefined }
          })
        }
      })

      setTimeout(() => {
        if (!started && this.process === proc && !rejected) {
          if (stream) {
            fail('Timeout — vérifiez URL RTMP et clé de stream')
          } else {
            markStarted()
          }
        }
      }, stream ? 20000 : 8000)
    })
  }

  async stop(): Promise<void> {
    if (this.audioRefreshTimer) {
      clearTimeout(this.audioRefreshTimer)
      this.audioRefreshTimer = null
    }
    this.sessionSettings = null
    this.sessionOptions = null
    this.sessionUsesNativeDesktop = false
    this.nativeDesktopPipe = null
    this.nativeDesktopStarted = false
    streamAudioMeterService.reset()

    if (!this.process) return

    await this.desktopCapture.stop()

    this.setState({
      stream: { ...this.state.stream, status: 'stopping', message: 'Arrêt en cours...' },
      recording: { ...this.state.recording, status: 'stopping' }
    })

    const proc = this.process
    this.flushPendingChunks()

    return new Promise((resolve) => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        clearTimeout(softKillTimeout)
        clearTimeout(hardKillTimeout)
        resolve()
      }

      const endStdin = () => {
        this.flushPendingChunks()
        try { proc.stdin.end() } catch { /* ignore */ }
      }
      // Laisser le renderer envoyer le dernier fragment WebM avant de fermer le pipe
      setTimeout(endStdin, 900)

      const softKillTimeout = setTimeout(() => {
        try { proc.kill('SIGTERM') } catch { /* ignore */ }
      }, 15000)

      const hardKillTimeout = setTimeout(() => {
        try { proc.kill('SIGKILL') } catch { /* ignore */ }
      }, 25000)

      proc.on('close', done)
    })
  }

  isActive(): boolean {
    return this.process !== null
  }
}
