import { useState, useCallback } from 'react'
import type { Scene, Source, SourceType } from '../types'
import { createSource } from '../types'

const STORAGE_KEY = 'nova-stream-scenes'

const DEFAULT_SCENES: Scene[] = [
  {
    id: 'scene-1',
    name: 'GAMING',
    sources: [
      { ...createSource('display'), visible: true, name: 'Game Capture' },
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

  const addSource = useCallback((type: SourceType) => {
    if (!activeScene) return
    const source = createSource(type)
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
    addSource,
    removeSource,
    updateSource,
    moveSource
  }
}
