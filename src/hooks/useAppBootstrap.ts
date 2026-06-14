import { useEffect, useState } from 'react'
import { hideHtmlSplash, waitForNovaStream, withTimeout } from '../lib/splash'

export type BootstrapStatus = 'loading' | 'ready' | 'error'

export function useAppBootstrap() {
  const [status, setStatus] = useState<BootstrapStatus>('loading')
  const [message, setMessage] = useState('Démarrage de Nova Stream…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      setMessage('Connexion au moteur…')
      const apiReady = await waitForNovaStream(10000)
      if (cancelled) return

      if (!apiReady) {
        setError('Le moteur de l’application n’a pas répondu. Relancez Nova Stream.')
        setStatus('error')
        return
      }

      setMessage('Chargement des services…')
      try {
        await withTimeout(
          Promise.all([
            window.novaStream.platform.getConfig(),
            window.novaStream.integrations.getConnections(),
            window.novaStream.media.getStatus()
          ]),
          15000,
          'Le démarrage prend trop de temps — vérifiez votre connexion.'
        )
        if (cancelled) return
        hideHtmlSplash()
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur au démarrage')
        setStatus('error')
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  return { status, message, error }
}
