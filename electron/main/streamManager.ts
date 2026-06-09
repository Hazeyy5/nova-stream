import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import ffmpegPath from 'ffmpeg-static'
import { buildFfmpegScenePipeArgs, buildRtmpUrl, defaultRecordingPath, parseFfmpegError } from './ffmpegBuilder'
import { listMediaDevices, resolveStreamSettings } from './deviceManager'
import type { MediaState, StreamSettings } from '../../src/types'

export interface StartMediaOptions {
  settings: StreamSettings
  stream?: boolean
  record?: boolean
}

export class StreamManager {
  private process: ChildProcessWithoutNullStreams | null = null
  private pendingChunks: Buffer[] = []
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

    const { settings, stream = false, record = false } = options
    if (!stream && !record) throw new Error('Aucune sortie sélectionnée')

    const devices = await listMediaDevices()
    const resolved = resolveStreamSettings(settings, devices)

    let recordPath: string | undefined
    if (record) {
      recordPath = resolved.recordingPath || defaultRecordingPath()
      mkdirSync(dirname(recordPath), { recursive: true })
    }

    const rtmpUrl = stream ? buildRtmpUrl(resolved) : undefined
    const includeAudio = stream || (record && resolved.recordAudioEnabled)
    const args = buildFfmpegScenePipeArgs(resolved, { rtmpUrl, recordPath, includeAudio })

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
        stdio: ['pipe', 'pipe', 'pipe']
      })
      this.process = proc
      this.pendingChunks = []

      let stderr = ''
      let started = false
      let rejected = false

      const fail = (message: string) => {
        if (rejected) return
        rejected = true
        this.process = null
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
          (stderr.includes('Error opening input') && includeAudio)

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

    this.setState({
      stream: { ...this.state.stream, status: 'stopping', message: 'Arrêt en cours...' },
      recording: { ...this.state.recording, status: 'stopping' }
    })

    const proc = this.process
    this.flushPendingChunks()

    return new Promise((resolve) => {
      const finish = () => {
        try { proc.stdin.end() } catch { /* ignore */ }
      }
      setTimeout(finish, 400)

      const timeout = setTimeout(() => {
        proc.kill('SIGKILL')
        resolve()
      }, 6000)
      proc.on('close', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  isActive(): boolean {
    return this.process !== null
  }
}
