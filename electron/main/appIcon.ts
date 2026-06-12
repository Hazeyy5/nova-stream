import { existsSync } from 'fs'
import { join } from 'path'
import { nativeImage, type NativeImage } from 'electron'

export function getAppIcon(): NativeImage | undefined {
  const candidates = [
    join(__dirname, '../../build/icon.png'),
    join(__dirname, '../../resources/icon.png'),
    join(process.resourcesPath, 'icon.png')
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    const image = nativeImage.createFromPath(path)
    if (!image.isEmpty()) return image
  }
  return undefined
}
