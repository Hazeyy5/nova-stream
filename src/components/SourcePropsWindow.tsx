import { useEffect, useState } from 'react'
import type { Source } from '../types'
import SourcePreview from './SourcePreview'
import SourceInspectorPanel from './SourceInspectorPanel'
import './SourceInspector.css'

const TYPE_LABELS: Partial<Record<Source['type'], string>> = {
  screen: 'Capture d\'écran',
  window: 'Capture de fenêtre',
  game: 'Capture de jeu',
  display: 'Sélecteur système',
  browser: 'Source navigateur',
  webcam: 'Capture vidéo',
  image: 'Image',
  text: 'Texte',
  chat: 'Chat Box',
  alert: 'Alert Box',
  followerGoal: 'Objectif followers',
  subGoal: 'Objectif abonnés',
  viewerCount: 'Spectateurs',
  poll: 'Sondage'
}

export default function SourcePropsWindow() {
  const [source, setSource] = useState<Source | null>(null)

  useEffect(() => {
    document.body.classList.add('source-props-page')
    return () => document.body.classList.remove('source-props-page')
  }, [])

  useEffect(() => {
    const unsubs = [
      window.novaStream.sourceProps.onInit(setSource),
      window.novaStream.sourceProps.onSync(setSource)
    ]
    window.novaStream.sourceProps.ready()
    return () => unsubs.forEach((u) => u())
  }, [])

  if (!source) {
    return (
      <div className="source-props-window-loading">
        Chargement…
      </div>
    )
  }

  const typeLabel = TYPE_LABELS[source.type] ?? source.type

  return (
    <div className="source-props-window">
      <header className="source-props-window-header">
        <h1>Paramètres — {source.name}</h1>
        <span className="source-props-window-type">{typeLabel}</span>
      </header>

      <SourcePreview source={source} />

      <div className="source-props-scroll">
        <SourceInspectorPanel
          source={source}
          onUpdate={(partial) => window.novaStream.sourceProps.patch(source.id, partial)}
          onRecapture={(kind) => window.novaStream.sourceProps.requestRecapture(source.id, kind)}
        />
      </div>

      <footer className="source-props-footer">
        <button type="button" className="source-props-close-btn" onClick={() => window.close()}>
          Fermer
        </button>
      </footer>
    </div>
  )
}
