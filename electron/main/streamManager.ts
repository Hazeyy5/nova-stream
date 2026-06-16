import { spawn, type ChildProcessWithoutNullStreams, type Writable } from 'child_process'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { resolveFfmpegPath } from './ffmpegPath'
import { buildFfmpegScenePipeArgs, buildRtmpUrl, resolveRecordingFilePath, parseFfmpegError, isAudioStartupError, resolveStreamMicLinear, resolveStreamDesktopLinear } from './ffmpegBuilder'
import { listMediaDevices, listDshowMediaDevices, resolveStreamSettings } from './deviceManager'
import { DesktopAudioCapture } from './desktopAudioCapture'
import { MicAudioCapture } from './micAudioCapture'
import { StreamMeterParser, streamAudioMeterService } from './streamMeterParser'
import { VideoPaceQueue, WEBM_CHUNK_DURATION_MS } from './videoPaceQueue'
import type { MediaState, StreamSettings } from '../../src/types'

export interface StartMediaOptions {
  settings: StreamSettings
  stream?: boolean
  record?: boolean
  videoInputFormat?: 'h264' | 'webm'
}

export class StreamManager {
  private process: ChildProcessWithoutNullStreams | null = null
  private desktopCapture = new DesktopAudioCapture()
  private micCapture = new MicAudioCapture()
  private sessionSettings: StreamSettings | null = null
  private sessionOptions: {
    stream: boolean
    record: boolean
    videoInputFormat: 'h264' | 'webm'
  } | null = null
  private audioRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private refreshingAudio = false
  private sessionUsesNativeDesktop = false
  private sessionUsesMicPipe = false
  private nativeDesktopPipe: Writable | null = null
  private micPipe: Writable | null = null
  private nativeDesktopStarted = false
  private micCaptureStarted = false
  private startCancelled = false
  private activeLaunch: {
    reject: (err: Error) => void
    resolve: () => void
    proc: ChildProcessWithoutNullStreams
    stream: boolean
  } | null = null
  private videoChunksReceived = 0
  private lastVideoChunkAt = 0
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private videoPaceQueue = new VideoPaceQueue()
  private sessionFramerate = 30
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
    /* Les chunks vidéo passent par VideoPaceQueue — rien à vider ici. */
  }

  private writeVideoToStdin(chunk: Buffer): void {
    const stdin = this.process?.stdin
    if (!stdin || stdin.destroyed || !stdin.writable) return
    stdin.write(chunk)
  }

  handleVideoChunk(chunk: Buffer): void {
    if (chunk.length === 0 || !this.process) return

    this.videoChunksReceived += 1
    this.lastVideoChunkAt = Date.now()
    this.videoPaceQueue.push(chunk)
  }

  private applyDesktopMix(chunk: Buffer, settings: StreamSettings): Buffer {
    if (!settings.desktopAudioEnabled) {
      return Buffer.alloc(chunk.length)
    }
    const linear = resolveStreamDesktopLinear(settings)
    if (linear <= 0) return Buffer.alloc(chunk.length)
    if (Math.abs(linear - 1) < 0.001) return chunk

    const samples = Math.floor(chunk.length / 2)
    const out = Buffer.alloc(chunk.length)
    for (let i = 0; i < samples; i++) {
      const scaled = Math.round(chunk.readInt16LE(i * 2) * linear)
      out.writeInt16LE(Math.max(-32768, Math.min(32767, scaled)), i * 2)
    }
    return out
  }

  private applyMixerLevels(settings: StreamSettings): void {
    this.micCapture.setMix(
      resolveStreamMicLinear(settings),
      !settings.audioEnabled
    )
  }

  private startNativeDesktopCaptureIfNeeded(): void {
    if (!this.sessionUsesNativeDesktop || this.nativeDesktopStarted) return
    this.nativeDesktopStarted = true

    const desktopPipe = this.nativeDesktopPipe
    desktopPipe?.on('error', () => { /* pipe fermé à l'arrêt */ })
    void this.desktopCapture.start((pcmChunk) => {
      const settings = this.sessionSettings
      if (!settings || !desktopPipe || desktopPipe.destroyed || !desktopPipe.writable) return
      desktopPipe.write(this.applyDesktopMix(pcmChunk, settings))
    }).catch(() => { /* capture bureau optionnelle */ })
  }

  private startMicCaptureIfNeeded(): void {
    if (!this.sessionUsesMicPipe || this.micCaptureStarted || !this.sessionSettings?.audioDevice) return
    this.micCaptureStarted = true

    const micPipe = this.micPipe
    const device = this.sessionSettings.audioDevice
    this.applyMixerLevels(this.sessionSettings)
    micPipe?.on('error', () => { /* pipe fermé à l'arrêt */ })
    void this.micCapture.start(device, (pcmChunk) => {
      if (!micPipe || micPipe.destroyed || !micPipe.writable) return
      const ok = micPipe.write(pcmChunk)
      if (!ok && pcmChunk.length > 0) {
        /* Évite l'accumulation de plusieurs secondes de micro en buffer */
        micPipe.once('drain', () => { /* reprend */ })
      }
    }).catch(() => { /* capture micro optionnelle */ })
  }

  async start(options: StartMediaOptions): Promise<void> {
    if (this.process) throw new Error('Une session média est déjà active')
    const ffmpegPath = resolveFfmpegPath()
    if (!ffmpegPath) throw new Error('FFmpeg introuvable')

    const { settings, stream = false, record = false, videoInputFormat = 'webm' } = options
    if (!stream && !record) throw new Error('Aucune sortie sélectionnée')

    this.sessionSettings = settings
    this.sessionOptions = { stream, record, videoInputFormat }
    this.startCancelled = false

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
      this.startHealthWatchdog()
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

  updateMixerSettings(settings: StreamSettings): void {
    if (!this.process || !this.sessionSettings) return
    this.sessionSettings = settings
    this.applyMixerLevels(settings)
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
    this.micCaptureStarted = false
    this.nativeDesktopPipe = null
    this.micPipe = null
    await this.desktopCapture.stop()
    await this.micCapture.stop()
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
    const ffmpegPath = resolveFfmpegPath()
    if (!ffmpegPath) return Promise.reject(new Error('FFmpeg introuvable'))

    let recordPath: string | undefined
    if (record) {
      recordPath = resolveRecordingFilePath(resolved.recordingPath)
      mkdirSync(dirname(recordPath), { recursive: true })
    }

    const rtmpUrl = stream ? buildRtmpUrl(resolved) : undefined
    const useNodeMix = includeAudio && !!resolved.audioDevice
    const { args, usesNativeDesktop, usesMicPipe, micPipeFd, desktopPipeFd, meterChannels } = buildFfmpegScenePipeArgs(resolved, {
      rtmpUrl,
      recordPath,
      includeAudio,
      videoInputFormat,
      micViaPipe: useNodeMix,
      mixViaNode: useNodeMix
    })
    const meterParser = new StreamMeterParser(meterChannels)

    console.info('[stream] ffmpeg', args.join(' '))

    if (stream && !quiet) {
      this.setState({ stream: { status: 'starting', message: 'Connexion au serveur...' } })
    }
    if (record && !quiet) {
      this.setState({
        recording: { status: 'recording', filePath: recordPath, startedAt: Date.now() }
      })
    }

    return new Promise((resolve, reject) => {
      const extraPipeFds = [micPipeFd, desktopPipeFd].filter((fd): fd is number => fd !== null)
      const maxFd = Math.max(2, ...extraPipeFds)
      const stdio: Array<'pipe' | 'ignore'> = ['pipe', 'pipe', 'pipe']
      for (let fd = 3; fd <= maxFd; fd++) {
        stdio[fd] = extraPipeFds.includes(fd) ? 'pipe' : 'ignore'
      }

      const proc = spawn(ffmpegPath, args, {
        windowsHide: true,
        stdio
      })
      this.process = proc
      this.videoChunksReceived = 0
      this.lastVideoChunkAt = 0
      this.sessionFramerate = resolved.framerate
      this.videoPaceQueue.reset()
      this.videoPaceQueue.configure(
        resolved.framerate,
        (buf) => this.writeVideoToStdin(buf),
        () => {
          this.startNativeDesktopCaptureIfNeeded()
          this.startMicCaptureIfNeeded()
        },
        {
          paceMode: videoInputFormat === 'webm' ? 'timed' : 'frame',
          chunkDurationMs: WEBM_CHUNK_DURATION_MS
        }
      )
      this.sessionUsesNativeDesktop = usesNativeDesktop
      this.sessionUsesMicPipe = usesMicPipe
      this.nativeDesktopPipe = desktopPipeFd !== null ? (proc.stdio[desktopPipeFd] as Writable | null) : null
      this.micPipe = micPipeFd !== null ? (proc.stdio[micPipeFd] as Writable | null) : null
      this.nativeDesktopStarted = false
      this.micCaptureStarted = false

      if (usesNativeDesktop) {
        this.nativeDesktopPipe?.on('error', () => { /* pipe fermé à l'arrêt */ })
      }
      if (usesMicPipe) {
        this.micPipe?.on('error', () => { /* pipe fermé à l'arrêt */ })
      }

      let stderr = ''
      let started = false
      let rejected = false
      let spawnedAt = 0
      let startTimeout: ReturnType<typeof setTimeout> | null = null
      let videoWatchdog: ReturnType<typeof setTimeout> | null = null
      let readyCheck: ReturnType<typeof setInterval> | null = null

      const clearStartTimeout = () => {
        if (startTimeout) {
          clearTimeout(startTimeout)
          startTimeout = null
        }
        if (videoWatchdog) {
          clearTimeout(videoWatchdog)
          videoWatchdog = null
        }
        if (readyCheck) {
          clearInterval(readyCheck)
          readyCheck = null
        }
      }

      const rejectLaunch = (message: string) => {
        if (rejected) return
        rejected = true
        clearStartTimeout()
        const launch = this.activeLaunch
        this.activeLaunch = null
        launch?.reject(new Error(message))
      }

      const fail = (message: string) => {
        if (rejected) return
        rejected = true
        clearStartTimeout()
        this.activeLaunch = null
        this.process = null
        void this.desktopCapture.stop()
        void this.micCapture.stop()
        try { proc.stdin.end() } catch { /* ignore */ }
        try { proc.kill('SIGKILL') } catch { /* ignore */ }
        this.setState({
          stream: { status: 'error', message },
          recording: { status: 'idle' }
        })
        reject(new Error(message))
      }

      const markStarted = () => {
        if (started || rejected) return
        started = true
        clearStartTimeout()
        this.activeLaunch = null
        if (stream) {
          this.setState({
            stream: { status: 'live', message: 'En direct', startedAt: Date.now() }
          })
          this.startHealthWatchdog()
        }
        resolve()
      }

      const isRtmpOutputError = (text: string): boolean => (
        text.includes('Error opening output') ||
        text.includes('Error writing trailer') ||
        text.includes('Error submitting a packet to muxer') ||
        (text.includes('I/O error') && text.includes('rtmp')) ||
        text.includes('Connection refused') ||
        text.includes('Connection timed out') ||
        text.includes('authfailed') ||
        text.includes('authentication failed') ||
        text.includes('Invalid stream key') ||
        text.includes('Failed to resolve hostname')
      )

      const isStreamEncoding = (text: string): boolean => (
        /frame=\s*\d+/i.test(text) ||
        /size=\s*\d+/i.test(text) ||
        /bitrate=\s*[\d.]+kbits\/s/i.test(text)
      )

      this.activeLaunch = { reject, resolve, proc, stream }

      proc.on('spawn', () => {
        spawnedAt = Date.now()
        if (record && !stream) markStarted()
      })

      if (stream) {
        videoWatchdog = setTimeout(() => {
          if (!started && !rejected && this.videoChunksReceived < 3) {
            fail('Aucune vidéo reçue par FFmpeg — vérifiez l\'aperçu et les sources de la scène.')
          }
        }, 6000)

        readyCheck = setInterval(() => {
          if (started || rejected || !spawnedAt) return
          const elapsed = Date.now() - spawnedAt
          if (elapsed < 2000 || this.videoChunksReceived < 4) return
          if (isRtmpOutputError(stderr)) return
          if (
            stderr.includes('Invalid data found when processing input') ||
            stderr.includes('Error while decoding stream')
          ) {
            return
          }
          markStarted()
        }, 400)
      }

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()

        const meterUpdates = meterParser.parseChunk(chunk.toString())
        if (meterUpdates) streamAudioMeterService.push(meterUpdates)

        if (!started && !rejected && stream && isRtmpOutputError(stderr)) {
          fail(parseFfmpegError(stderr))
          return
        }

        const audioInputError =
          stderr.includes('Could not find audio device') ||
          stderr.includes('Could not find audio only device') ||
          stderr.includes('Error opening input file audio=') ||
          (stderr.includes('Error opening input') && includeAudio)

        if (!started && audioInputError) {
          fail(parseFfmpegError(stderr))
          return
        }

        if (!started && isStreamEncoding(stderr)) {
          markStarted()
        }
      })

      proc.stdin.on('error', () => { /* pipe fermé à l'arrêt */ })

      proc.on('error', (err) => {
        fail(err.message)
      })

      proc.on('close', (code) => {
        clearStartTimeout()
        this.activeLaunch = null
        this.process = null
        const stopping = this.state.stream.status === 'stopping' || this.startCancelled

        if (stopping) {
          if (!rejected) {
            rejectLaunch('Connexion annulée')
            this.setState({
              stream: { status: 'idle', message: undefined, startedAt: undefined },
              recording: { status: 'idle', filePath: undefined, startedAt: undefined }
            })
          }
          return
        }

        if (!started && !rejected) {
          fail(parseFfmpegError(stderr))
          return
        }

        if (code !== 0 && code !== null && !rejected) {
          const message = parseFfmpegError(stderr)
          this.setState({
            stream: { status: 'error', message },
            recording: { status: 'idle' }
          })
        } else if (!rejected) {
          this.stopHealthWatchdog()
          this.setState({
            stream: { status: 'idle', message: undefined, startedAt: undefined },
            recording: { status: 'idle', filePath: undefined, startedAt: undefined }
          })
        }
      })

      startTimeout = setTimeout(() => {
        if (!started && this.process === proc && !rejected) {
          if (stream) {
            const hint = this.videoChunksReceived < 3
              ? 'Aucune vidéo reçue par FFmpeg — vérifiez l\'aperçu.'
              : 'FFmpeg n\'a pas pu envoyer le flux à Twitch — vérifiez la clé de stream.'
            console.error('[stream] timeout', { videoChunks: this.videoChunksReceived, stderr: stderr.slice(-2000) })
            fail(hint)
          } else {
            markStarted()
          }
        }
      }, stream ? 12000 : 8000)
    })
  }

  async stop(): Promise<void> {
    this.stopHealthWatchdog()
    this.videoPaceQueue.reset()
    if (this.audioRefreshTimer) {
      clearTimeout(this.audioRefreshTimer)
      this.audioRefreshTimer = null
    }

    this.startCancelled = true
    const launch = this.activeLaunch

    if (!this.process && !launch) {
      this.sessionSettings = null
      this.sessionOptions = null
      this.sessionUsesNativeDesktop = false
      this.sessionUsesMicPipe = false
      this.nativeDesktopPipe = null
      this.micPipe = null
      this.nativeDesktopStarted = false
      this.micCaptureStarted = false
      streamAudioMeterService.reset()
      this.setState({
        stream: { status: 'idle', message: undefined, startedAt: undefined },
        recording: { status: 'idle', filePath: undefined, startedAt: undefined }
      })
      return
    }

    this.sessionSettings = null
    this.sessionOptions = null
    this.sessionUsesNativeDesktop = false
    this.sessionUsesMicPipe = false
    this.nativeDesktopPipe = null
    this.micPipe = null
    this.nativeDesktopStarted = false
    this.micCaptureStarted = false
    streamAudioMeterService.reset()

    await this.desktopCapture.stop()
    await this.micCapture.stop()

    const wasStarting = this.state.stream.status === 'starting'
    this.setState({
      stream: {
        ...this.state.stream,
        status: wasStarting ? 'stopping' : 'stopping',
        message: wasStarting ? 'Annulation...' : 'Arrêt en cours...'
      },
      recording: { ...this.state.recording, status: 'stopping' }
    })

    const proc = this.process ?? launch?.proc
    if (!proc) {
      this.setState({
        stream: { status: 'idle', message: undefined, startedAt: undefined },
        recording: { status: 'idle', filePath: undefined, startedAt: undefined }
      })
      return
    }

    this.process = null
    this.activeLaunch = null
    this.flushPendingChunks()

    if (wasStarting) {
      rejectLaunch('Connexion annulée')
      try { proc.stdin.end() } catch { /* ignore */ }
      try { proc.kill('SIGKILL') } catch { /* ignore */ }
    }

    return new Promise((resolve) => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        clearTimeout(softKillTimeout)
        clearTimeout(hardKillTimeout)
        resolve()
      }

      if (wasStarting) {
        proc.on('close', done)
        setTimeout(done, 1200)
        return
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
    }).finally(() => {
      this.startCancelled = false
      if (this.state.stream.status === 'stopping') {
        this.setState({
          stream: { status: 'idle', message: undefined, startedAt: undefined },
          recording: { status: 'idle', filePath: undefined, startedAt: undefined }
        })
      }
    })
  }

  isActive(): boolean {
    return this.process !== null
  }

  getHealth(): {
    ffmpegRunning: boolean
    videoFlowing: boolean
    lastVideoChunkAgeMs: number
    videoChunksTotal: number
  } {
    const age = this.lastVideoChunkAt > 0 ? Date.now() - this.lastVideoChunkAt : Number.MAX_SAFE_INTEGER
    return {
      ffmpegRunning: this.process !== null,
      videoFlowing: age < 5000,
      lastVideoChunkAgeMs: this.lastVideoChunkAt > 0 ? age : -1,
      videoChunksTotal: this.videoChunksReceived
    }
  }

  private startHealthWatchdog(): void {
    this.stopHealthWatchdog()
    this.healthTimer = setInterval(() => {
      if (this.state.stream.status !== 'live') return
      if (!this.process) {
        this.setState({
          stream: {
            status: 'error',
            message: 'Le flux s\'est arrêté — relancez le live.',
            startedAt: undefined
          }
        })
        return
      }
      const age = this.lastVideoChunkAt > 0 ? Date.now() - this.lastVideoChunkAt : Number.MAX_SAFE_INTEGER
      if (age > 12000) {
        this.setState({
          stream: {
            ...this.state.stream,
            status: 'error',
            message: 'Plus de vidéo envoyée — vérifiez l\'aperçu ou relancez le live.',
            startedAt: undefined
          }
        })
      }
    }, 4000)
  }

  private stopHealthWatchdog(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
  }
}
