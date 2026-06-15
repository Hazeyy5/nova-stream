import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import { resolveFfmpegPath } from './ffmpegPath'
import type { VideoEncoder, EncoderOptionInfo, EncoderRecommendation } from '../../src/types'

const execFileAsync = promisify(execFile)

interface GpuInfo {
  name: string
  vendor: 'nvidia' | 'amd' | 'intel' | 'other'
  vramBytes: number
  discrete: boolean
}

const ENCODER_LABELS: Record<VideoEncoder, string> = {
  nvenc: 'NVIDIA NVENC (GPU)',
  amf: 'AMD AMF (GPU)',
  qsv: 'Intel Quick Sync (GPU)',
  x264: 'CPU (x264)'
}

const ENCODER_DESCRIPTIONS: Record<VideoEncoder, string> = {
  nvenc: 'Encodeur matériel NVIDIA — faible charge CPU, idéal pour le live.',
  amf: 'Encodeur matériel AMD — performant sur cartes Radeon récentes.',
  qsv: 'Encodeur Intel Quick Sync — efficace sur processeurs Intel récents.',
  x264: 'Encodeur logiciel — compatible partout, plus exigeant pour le processeur.'
}

const FFMPEG_ENCODER_IDS: Record<VideoEncoder, string> = {
  nvenc: 'h264_nvenc',
  amf: 'h264_amf',
  qsv: 'h264_qsv',
  x264: 'libx264'
}

function classifyGpu(name: string, vramBytes: number): GpuInfo {
  const lower = name.toLowerCase()
  let vendor: GpuInfo['vendor'] = 'other'
  if (/nvidia|geforce|rtx|gtx|quadro|tesla/.test(lower)) vendor = 'nvidia'
  else if (/amd|radeon|rx\s|vega|firepro/.test(lower)) vendor = 'amd'
  else if (/intel|uhd|iris|arc/.test(lower)) vendor = 'intel'

  const skip = /microsoft basic|remote desktop|virtual|parsec|vmware|citrix|meta virtual/.test(lower)
  const discrete = !skip && (
    vendor === 'nvidia' ||
    vendor === 'amd' ||
    (vendor === 'intel' && /arc/i.test(name)) ||
    vramBytes >= 512 * 1024 * 1024
  )

  return { name, vendor, vramBytes, discrete }
}

async function detectGpusWindows(): Promise<GpuInfo[]> {
  try {
    const ps = [
      '-NoProfile',
      '-Command',
      'Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json -Compress'
    ]
    const { stdout } = await execFileAsync('powershell.exe', ps, {
      timeout: 12000,
      windowsHide: true
    })
    const trimmed = stdout.trim()
    if (!trimmed) return []

    const parsed = JSON.parse(trimmed) as { Name?: string; AdapterRAM?: number } | Array<{ Name?: string; AdapterRAM?: number }>
    const rows = Array.isArray(parsed) ? parsed : [parsed]

    return rows
      .filter((row) => row.Name && !/microsoft basic/i.test(row.Name))
      .map((row) => classifyGpu(row.Name!, Number(row.AdapterRAM) || 0))
  } catch {
    return []
  }
}

async function detectGpus(): Promise<GpuInfo[]> {
  if (process.platform === 'win32') return detectGpusWindows()
  return []
}

function detectCpu(): { name: string; cores: number } {
  const cpus = os.cpus()
  return {
    name: cpus[0]?.model?.trim() || 'Processeur inconnu',
    cores: cpus.length
  }
}

async function probeFfmpegEncoders(): Promise<Set<VideoEncoder>> {
  const available = new Set<VideoEncoder>()
  const ffmpegPath = resolveFfmpegPath()
  if (!ffmpegPath) {
    available.add('x264')
    return available
  }

  try {
    const { stdout } = await execFileAsync(ffmpegPath, ['-hide_banner', '-encoders'], {
      timeout: 10000,
      windowsHide: true
    })
    const text = stdout.toLowerCase()
    for (const [id, ffmpegId] of Object.entries(FFMPEG_ENCODER_IDS)) {
      if (text.includes(ffmpegId.toLowerCase())) {
        available.add(id as VideoEncoder)
      }
    }
  } catch {
    available.add('x264')
  }

  if (available.size === 0) available.add('x264')
  return available
}

function pickBestGpu(gpus: GpuInfo[]): GpuInfo | null {
  const candidates = gpus.filter((g) => g.discrete || g.vendor !== 'other')
  if (candidates.length === 0) return gpus[0] ?? null

  const score = (g: GpuInfo): number => {
    let s = g.vramBytes
    if (g.discrete) s += 2_000_000_000
    if (g.vendor === 'nvidia') s += 1_500_000_000
    if (g.vendor === 'amd') s += 1_000_000_000
    if (g.vendor === 'intel') s += 500_000_000
    return s
  }

  return [...candidates].sort((a, b) => score(b) - score(a))[0]
}

function recommendEncoder(
  gpus: GpuInfo[],
  cpuCores: number,
  available: Set<VideoEncoder>
): { encoder: VideoEncoder; reason: string } {
  const bestGpu = pickBestGpu(gpus)

  if (bestGpu?.vendor === 'nvidia' && available.has('nvenc')) {
    return {
      encoder: 'nvenc',
      reason: `Carte NVIDIA détectée (${bestGpu.name}) — NVENC offre la meilleure performance pour le streaming.`
    }
  }

  if (bestGpu?.vendor === 'amd' && available.has('amf')) {
    return {
      encoder: 'amf',
      reason: `Carte AMD détectée (${bestGpu.name}) — l'encodeur AMF est recommandé pour limiter la charge CPU.`
    }
  }

  const intelGpu = gpus.find((g) => g.vendor === 'intel')
  if (intelGpu && available.has('qsv')) {
    return {
      encoder: 'qsv',
      reason: `Graphiques Intel détectés (${intelGpu.name}) — Quick Sync est le choix le plus efficace.`
    }
  }

  if (available.has('nvenc') && gpus.some((g) => g.vendor === 'nvidia')) {
    return {
      encoder: 'nvenc',
      reason: 'Encodeur NVIDIA NVENC disponible via FFmpeg.'
    }
  }

  if (available.has('amf') && gpus.some((g) => g.vendor === 'amd')) {
    return {
      encoder: 'amf',
      reason: 'Encodeur AMD AMF disponible via FFmpeg.'
    }
  }

  if (available.has('qsv')) {
    return {
      encoder: 'qsv',
      reason: 'Intel Quick Sync disponible — plus léger que l\'encodage CPU pur.'
    }
  }

  if (cpuCores >= 8) {
    return {
      encoder: 'x264',
      reason: `Processeur ${cpuCores} cœurs — x264 convient, aucun encodeur GPU matériel détecté.`
    }
  }

  if (cpuCores >= 4) {
    return {
      encoder: 'x264',
      reason: `Aucun encodeur GPU détecté. x264 fonctionne sur votre processeur (${cpuCores} cœurs) — privilégiez 720p si les performances chutent.`
    }
  }

  return {
    encoder: 'x264',
    reason: 'Encodeur CPU (x264) — seule option compatible. Réduisez la résolution ou le framerate si besoin.'
  }
}

export async function scanEncoderRecommendation(): Promise<EncoderRecommendation> {
  const [gpus, availableSet] = await Promise.all([
    detectGpus(),
    probeFfmpegEncoders()
  ])
  const { name: cpuName, cores: cpuCores } = detectCpu()
  const { encoder: recommended, reason } = recommendEncoder(gpus, cpuCores, availableSet)

  const allEncoders: VideoEncoder[] = ['nvenc', 'amf', 'qsv', 'x264']
  const options: EncoderOptionInfo[] = allEncoders.map((id) => ({
    id,
    label: ENCODER_LABELS[id],
    available: availableSet.has(id),
    description: ENCODER_DESCRIPTIONS[id]
  }))

  return {
    recommended,
    reason,
    gpus,
    cpuName,
    cpuCores,
    availableEncoders: allEncoders.filter((id) => availableSet.has(id)),
    options,
    scannedAt: Date.now()
  }
}
