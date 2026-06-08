import { createServer, type Server } from 'http'

export function waitForOAuthCallback(port: number, pathPrefix: string): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    let server: Server
    const timeout = setTimeout(() => {
      server?.close()
      reject(new Error('Connexion expirée — réessayez'))
    }, 120000)

    server = createServer((req, res) => {
      if (!req.url?.startsWith(pathPrefix)) {
        res.writeHead(404)
        res.end()
        return
      }

      const url = new URL(req.url, `http://localhost:${port}`)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f0f18;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center"><h2 style="color:#00c2a8">✓ Connexion réussie !</h2><p>Vous pouvez fermer cette fenêtre et retourner sur Nova Stream.</p></div>
      </body></html>`)

      clearTimeout(timeout)
      server.close()
      resolve(url.searchParams)
    })

    server.listen(port)
  })
}
