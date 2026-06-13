import { existsSync, readFileSync } from 'fs'
import { extname, join, normalize } from 'path'
import type { ServerResponse } from 'http'

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
}

export function docsRoot(): string {
  const dev = join(__dirname, '../../docs')
  if (existsSync(dev)) return dev
  return join(process.resourcesPath, 'docs')
}

export function tryServeDocsStatic(pathname: string, res: ServerResponse): boolean {
  if (!pathname.startsWith('/css/') && !pathname.startsWith('/js/')) return false

  const root = normalize(docsRoot())
  const filePath = normalize(join(root, pathname.slice(1)))
  if (!filePath.startsWith(root) || !existsSync(filePath)) return false

  const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' })
  res.end(readFileSync(filePath))
  return true
}
