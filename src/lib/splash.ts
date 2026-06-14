export function hideHtmlSplash(): void {
  const splash = document.getElementById('app-splash')
  if (!splash) return
  splash.classList.add('app-splash--hide')
  window.setTimeout(() => splash.remove(), 320)
}

export function waitForNovaStream(timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now()
    const tick = () => {
      if (window.novaStream) {
        resolve(true)
        return
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(false)
        return
      }
      window.setTimeout(tick, 40)
    }
    tick()
  })
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs)
    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        window.clearTimeout(timer)
        reject(err)
      })
  })
}
