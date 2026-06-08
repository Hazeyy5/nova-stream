import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import ffmpegPath from 'ffmpeg-static'
import { buildFfmpegArgs, buildRtmpUrl, defaultRecordingPath } from './ffmpegBuilder'
import type { MediaState, SceneStreamConfig, StreamSettings } from '../../src/types'

export interface StartMediaOptions {
  settings: StreamSettings
  scene: SceneStreamConfig
  stream?: boolean
  record?: boolean
}

export class StreamManager {
  private process: ChildProcessWithoutNullStreams | null = null
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

  async start(options: StartMediaOptions): Promise<void> {
    if (this.process) throw new Error('Une session média est déjà active')
    if (!ffmpegPath) throw new Error('FFmpeg introuvable')

    const { settings, scene, stream = false, record = false } = options
    if (!stream && !record) throw new Error('Aucune sortie sélectionnée')

    let recordPath: string | undefined
    if (record) {
      recordPath = settings.recordingPath || defaultRecordingPath()
      mkdirSync(dirname(recordPath), { recursive: true })
    }

    const rtmpUrl = stream ? buildRtmpUrl(settings) : undefined
    const args = buildFfmpegArgs(settings, scene, { rtmpUrl, recordPath })

    if (stream) {
      this.setState({ stream: { status: 'starting', message: 'Connexion au serveur...' } })
    }
    if (record) {
      this.setState({
        recording: { status: 'recording', filePath: recordPath, startedAt: Date.now() }
      })
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath!, args, { windowsHide: true })
      this.process = proc

      let stderr = ''
      let streamStarted = !stream

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
        if (!streamStarted && stderr.includes('frame=')) {
          streamStarted = true
          this.setState({
            stream: { status: 'live', message: 'En direct', startedAt: Date.now() }
          })
          resolve()
        }
      })

      proc.on('error', (err) => {
        this.process = null
        this.setState({
          stream: { status: 'error', message: err.message },
          recording: { status: 'idle' }
        })
        reject(err)
      })

      proc.on('close', (code) => {
        this.process = null
        const stopping = this.state.stream.status === 'stopping'

        if (code !== 0 && code !== null && !stopping) {
          const lastLine = stderr.trim().split('\n').pop() ?? 'Erreur FFmpeg'
          this.setState({
            stream: { status: 'error', message: lastLine },
            recording: { status: 'idle' }
          })
        } else {
          this.setState({
            stream: { status: 'idle', message: undefined, startedAt: undefined },
            recording: { status: 'idle', filePath: undefined, startedAt: undefined }
          })
        }
      })

      if (!stream) resolve()

      setTimeout(() => {
        if (!streamStarted && this.process === proc && stream) {
          reject(new Error('Timeout — vérifiez URL RTMP et clé de stream'))
          void this.stop()
        }
      }, 15000)
    })
  }

  async stop(): Promise<void> {
    if (!this.process) return

    this.setState({
      stream: { ...this.state.stream, status: 'stopping', message: 'Arrêt en cours...' },
      recording: { ...this.state.recording, status: 'stopping' }
    })

    const proc = this.process
    try { proc.stdin.write('q') } catch { /* ignore */ }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL')
        resolve()
      }, 5000)
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
