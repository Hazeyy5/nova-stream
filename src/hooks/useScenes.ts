import { useState, useCallback } from 'react'
import type { Scene, Source, SourceType } from '../types'
import { createSource } from '../types'

const STORAGE_KEY = 'nova-stream-scenes'

const DEFAULT_SCENES: Scene[] = [
  {
    id: 'scene-1',
    name: 'GAMING',
    sources: [
      { ...createSource('screen'), visible: true, name: 'Jeu' },
      { ...createSource('webcam'), visible: true, name: 'CAM' },
      { ...createSource('chat'), visible: true },
      { ...createSource('alert'), visible: true }
    ]
  },
  {
    id: 'scene-2',
    name: 'Just Chatting',
    sources: [{ ...createSource('webcam'), visible: true }]
  },
  {
    id: 'scene-3',
    name: 'BRB',
    sources: [{ ...createSource('text'), visible: true, name: 'Pause', textContent: '⏸ Pause — je reviens !' }]
  }
]

function loadScenes(): Scene[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : DEFAULT_SCENES
  } catch {
    return DEFAULT_SCENES
  }
}

export function useScenes() {
  const [scenes, setScenes] = useState<Scene[]>(loadScenes)
  const [activeSceneId, setActiveSceneId] = useState(() => loadScenes()[0]?.id ?? '')
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

  const selectSource = (id: string | null) => setSelectedSourceId(id)

  const persist = useCallback((next: Scene[]) => {
    setScenes(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0]

  const updateScene = useCallback((sceneId: string, updater: (scene: Scene) => Scene) => {
    persist(scenes.map((s) => (s.id === sceneId ? updater(s) : s)))
  }, [scenes, persist])

  const addScene = useCallback(() => {
    const id = `scene-${Date.now()}`
    const next = [...scenes, { id, name: `Scène ${scenes.length + 1}`, sources: [] }]
    persist(next)
    setActiveSceneId(id)
  }, [scenes, persist])

  const removeScene = useCallback((sceneId: string) => {
    if (scenes.length <= 1) return
    const next = scenes.filter((s) => s.id !== sceneId)
    persist(next)
    if (activeSceneId === sceneId) setActiveSceneId(next[0].id)
  }, [scenes, activeSceneId, persist])

  const renameScene = useCallback((sceneId: string, name: string) => {
    updateScene(sceneId, (s) => ({ ...s, name }))
  }, [updateScene])

  const moveScene = useCallback((sceneId: string, direction: 'up' | 'down') => {
    const idx = scenes.findIndex((s) => s.id === sceneId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= scenes.length) return
    const next = [...scenes]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    persist(next)
  }, [scenes, persist])

  const exportScenes = useCallback(() => {
    const blob = new Blob([JSON.stringify(scenes, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    anchor.href = url
    anchor.download = `nova-stream-scenes-${stamp}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [scenes])

  const importScenesFromJson = useCallback((json: string) => {
    const data = JSON.parse(json) as Scene[]
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Fichier de scènes vide ou invalide')
    }
    for (const scene of data) {
      if (!scene.id || !scene.name || !Array.isArray(scene.sources)) {
        throw new Error('Format de scène invalide')
      }
    }
    persist(data)
    setActiveSceneId(data[0].id)
    setSelectedSourceId(null)
  }, [persist])

  const duplicateScene = useCallback((sceneId: string) => {
    const original = scenes.find((s) => s.id === sceneId)
    if (!original) return
    const id = `scene-${Date.now()}`
    const copy: Scene = {
      id,
      name: `${original.name} (copie)`,
      sources: original.sources.map((src, i) => ({
        ...src,
        id: `src-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        transform: { ...src.transform }
      }))
    }
    const next = [...scenes, copy]
    persist(next)
    setActiveSceneId(id)
  }, [scenes, persist])

  const addSource = useCallback((type: SourceType, extra?: Partial<Source>) => {
    if (!activeScene) return
    const source = { ...createSource(type), ...extra }
    updateScene(activeScene.id, (s) => ({
      ...s,
      sources: [...s.sources, source]
    }))
    setSelectedSourceId(source.id)
  }, [activeScene, updateScene])

  const removeSource = useCallback((sourceId: string) => {
    if (!activeScene) return
    updateScene(activeScene.id, (s) => ({
      ...s,
      sources: s.sources.filter((src) => src.id !== sourceId)
    }))
    if (selectedSourceId === sourceId) setSelectedSourceId(null)
  }, [activeScene, selectedSourceId, updateScene])

  const updateSource = useCallback((sourceId: string, partial: Partial<Source>) => {
    if (!activeScene) return
    updateScene(activeScene.id, (s) => ({
      ...s,
      sources: s.sources.map((src) =>
        src.id === sourceId ? { ...src, ...partial } : src
      )
    }))
  }, [activeScene, updateScene])

  const duplicateSource = useCallback((sourceId: string) => {
    if (!activeScene) return
    const original = activeScene.sources.find((s) => s.id === sourceId)
    if (!original) return
    const copy: Source = {
      ...original,
      id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${original.name} (copie)`,
      transform: {
        ...original.transform,
        x: Math.min(95, original.transform.x + 3),
        y: Math.min(95, original.transform.y + 3),
        zIndex: activeScene.sources.length
      }
    }
    updateScene(activeScene.id, (s) => ({
      ...s,
      sources: [...s.sources, copy]
    }))
    setSelectedSourceId(copy.id)
  }, [activeScene, updateScene])

  const moveSource = useCallback((sourceId: string, direction: 'up' | 'down') => {
    if (!activeScene) return
    const sources = [...activeScene.sources]
    const idx = sources.findIndex((s) => s.id === sourceId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sources.length) return
    ;[sources[idx], sources[swapIdx]] = [sources[swapIdx], sources[idx]]
    const reindexed = sources.map((s, i) => ({
      ...s,
      transform: { ...s.transform, zIndex: i }
    }))
    updateScene(activeScene.id, (s) => ({ ...s, sources: reindexed }))
  }, [activeScene, updateScene])

  const selectedSource = activeScene?.sources.find((s) => s.id === selectedSourceId) ?? null

  return {
    scenes,
    activeScene,
    activeSceneId,
    setActiveSceneId,
    selectedSource,
    selectedSourceId,
    setSelectedSourceId: selectSource,
    addScene,
    removeScene,
    renameScene,
    duplicateScene,
    moveScene,
    exportScenes,
    importScenesFromJson,
    addSource,
    removeSource,
    updateSource,
    moveSource,
    duplicateSource
  }
}
