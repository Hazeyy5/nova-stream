import { spawn, type ChildProcessWithoutNullStreams, type Writable } from 'child_process'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import ffmpegPath from 'ffmpeg-static'
import { buildFfmpegScenePipeArgs, buildRtmpUrl, resolveRecordingFilePath, parseFfmpegError } from './ffmpegBuilder'
import { listMediaDevices, listDshowMediaDevices, resolveStreamSettings } from './deviceManager'
import { DesktopAudioCapture } from './desktopAudioCapture'
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
    const stdin = this.process?.stdin
    if (!stdin || stdin.destroyed || !stdin.writable) return
    for (const chunk of this.pendingChunks) stdin.write(chunk)
    this.pendingChunks = []
  }

  handleVideoChunk(chunk: Buffer): void {
    const stdin = this.process?.stdin
    if (!stdin || stdin.destroyed || !stdin.writable) {
      this.pendingChunks.push(chunk)
      if (this.pendingChunks.length > 120) this.pendingChunks.shift()
      return
    }
    this.flushPendingChunks()
    stdin.write(chunk)
  }

  async start(options: StartMediaOptions): Promise<void> {
    if (this.process) throw new Error('Une session média est déjà active')
    if (!ffmpegPath) throw new Error('FFmpeg introuvable')

    const { settings, stream = false, record = false, videoInputFormat = 'webm' } = options
    if (!stream && !record) throw new Error('Aucune sortie sélectionnée')

    const [devices, dshowDevices] = await Promise.all([
      listMediaDevices(),
      listDshowMediaDevices()
    ])
    const resolved = resolveStreamSettings(settings, devices, dshowDevices)

    let recordPath: string | undefined
    if (record) {
      recordPath = resolveRecordingFilePath(resolved.recordingPath)
      mkdirSync(dirname(recordPath), { recursive: true })
    }

    const rtmpUrl = stream ? buildRtmpUrl(resolved) : undefined
    const includeAudio = stream || (
      record &&
      resolved.recordAudioEnabled &&
      (resolved.audioEnabled || resolved.desktopAudioEnabled)
    )
    const { args, usesNativeDesktop } = buildFfmpegScenePipeArgs(resolved, {
      rtmpUrl,
      recordPath,
      includeAudio,
      videoInputFormat
    })

    if (stream) {
      this.setState({ stream: { status: 'starting', message: 'Connexion au serveur...' } })
    }
    if (record) {
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

      if (usesNativeDesktop) {
        const desktopPipe = proc.stdio[3] as Writable | null
        desktopPipe?.on('error', () => { /* pipe fermé à l'arrêt */ })
        void this.desktopCapture.start((chunk) => {
          if (desktopPipe && !desktopPipe.destroyed && desktopPipe.writable) {
            desktopPipe.write(chunk)
          }
        }).catch(() => { /* capture bureau optionnelle */ })
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

        const audioInputError =
          stderr.includes('Could not find audio device') ||
          stderr.includes('Could not find audio only device') ||
          stderr.includes('Error opening input file audio=')

        if (!started && audioInputError) {
          fail(parseFfmpegError(stderr))
          return
        }

        if (!started && (stderr.includes('frame=') || stderr.includes('Output #0'))) {
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
      }, stream ? 15000 : 8000)
    })
  }

  async stop(): Promise<void> {
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
