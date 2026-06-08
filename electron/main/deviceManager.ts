import { spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import type { MediaDevice } from '../../src/types'

export async function listMediaDevices(): Promise<MediaDevice[]> {
  if (!ffmpegPath) return []

  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], {
      windowsHide: true
    })

    let output = ''
    proc.stderr.on('data', (chunk: Buffer) => { output += chunk.toString() })
    proc.on('close', () => resolve(parseDshowDevices(output)))
    proc.on('error', () => resolve([]))

    setTimeout(() => {
      proc.kill()
      resolve(parseDshowDevices(output))
    }, 5000)
  })
}

function parseDshowDevices(output: string): MediaDevice[] {
  const devices: MediaDevice[] = []
  let currentType: 'audio' | 'video' | null = null

  for (const line of output.split('\n')) {
    if (line.includes('DirectShow video devices')) currentType = 'video'
    else if (line.includes('DirectShow audio devices')) currentType = 'audio'
    else if (line.includes('Alternative name')) continue
    else {
      const match = line.match(/"([^"]+)"/)
      if (match && currentType) {
        devices.push({ name: match[1], type: currentType })
      }
    }
  }

  return devices
}
