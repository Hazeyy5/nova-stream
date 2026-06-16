import { useState, useCallback } from 'react'
import type { Scene, SceneCollection, SceneCollectionsStore, Source, SourceType, WebWidgetSettings } from '../types'
import { createSource } from '../types'
import { applyWebWidgetSettingsToScenes } from '../lib/applyWebWidgetSettings'
import { createCollectionFromTemplate, createDefaultCollection, type SceneTemplateId, type TemplateLayoutOptions } from '../lib/sceneTemplates'
import { probeWebcamResolution } from '../lib/webcamLayout'

const LEGACY_SCENES_KEY = 'nova-stream-scenes'
const COLLECTIONS_KEY = 'nova-stream-collections'

function freshId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function migrateSource(source: Source): Source {
  const isGoalWidget =
    source.type === 'followerGoal' || source.type === 'subGoal' || source.type === 'viewerCount'
  if (!isGoalWidget) return source
  if (source.widgetUseLiveData === undefined) {
    return { ...source, widgetUseLiveData: true }
  }
  return source
}

function migrateScenes(scenes: Scene[]): Scene[] {
  return scenes.map((scene) => ({
    ...scene,
    sources: scene.sources.map(migrateSource)
  }))
}

function loadStore(): SceneCollectionsStore {
  try {
    const saved = localStorage.getItem(COLLECTIONS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as SceneCollectionsStore
      if (parsed.collections?.length > 0 && parsed.activeCollectionId) {
        return {
          collections: parsed.collections.map((col) => ({
            ...col,
            scenes: migrateScenes(col.scenes)
          })),
          activeCollectionId: parsed.activeCollectionId
        }
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const legacy = localStorage.getItem(LEGACY_SCENES_KEY)
    if (legacy) {
      const scenes = migrateScenes(JSON.parse(legacy) as Scene[])
      const collection: SceneCollection = {
        id: 'col-legacy',
        name: 'Ma collection',
        scenes,
        activeSceneId: scenes[0]?.id ?? ''
      }
      return { collections: [collection], activeCollectionId: collection.id }
    }
  } catch {
    /* ignore */
  }

  const defaultCol = createDefaultCollection()
  return { collections: [defaultCol], activeCollectionId: defaultCol.id }
}

function saveStore(store: SceneCollectionsStore): void {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(store))
  localStorage.removeItem(LEGACY_SCENES_KEY)
}

function parseImportedScenes(json: string): Scene[] {
  const data = JSON.parse(json) as unknown

  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error('Fichier de scènes vide')
    for (const scene of data) {
      const s = scene as Scene
      if (!s.id || !s.name || !Array.isArray(s.sources)) {
        throw new Error('Format de scène invalide')
      }
    }
    return migrateScenes(data as Scene[])
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (obj.type === 'nova-stream-collection' && obj.collection) {
      const col = obj.collection as SceneCollection
      if (!Array.isArray(col.scenes) || col.scenes.length === 0) {
        throw new Error('Collection vide ou invalide')
      }
      return migrateScenes(col.scenes)
    }
    if (Array.isArray(obj.scenes)) {
      const scenes = obj.scenes as Scene[]
      if (scenes.length === 0) throw new Error('Fichier de scènes vide')
      return migrateScenes(scenes)
    }
  }

  throw new Error('Format de fichier non reconnu')
}

export function useScenes() {
  const [store, setStore] = useState<SceneCollectionsStore>(loadStore)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

  const activeCollection =
    store.collections.find((c) => c.id === store.activeCollectionId) ?? store.collections[0]

  const scenes = activeCollection?.scenes ?? []
  const activeSceneId = activeCollection?.activeSceneId ?? ''
  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0]

  const persistStore = useCallback((next: SceneCollectionsStore) => {
    setStore(next)
    saveStore(next)
  }, [])

  const updateActiveCollection = useCallback((
    updater: (collection: SceneCollection) => SceneCollection
  ) => {
    if (!activeCollection) return
    const nextCollections = store.collections.map((col) =>
      col.id === activeCollection.id ? updater(col) : col
    )
    persistStore({ ...store, collections: nextCollections })
  }, [activeCollection, persistStore, store])

  const setActiveSceneId = useCallback((sceneId: string) => {
    updateActiveCollection((col) => ({ ...col, activeSceneId: sceneId }))
  }, [updateActiveCollection])

  const selectSource = (id: string | null) => setSelectedSourceId(id)

  const persistScenes = useCallback((nextScenes: Scene[], nextActiveSceneId?: string) => {
    updateActiveCollection((col) => ({
      ...col,
      scenes: nextScenes,
      activeSceneId: nextActiveSceneId ?? col.activeSceneId
    }))
  }, [updateActiveCollection])

  const updateScene = useCallback((sceneId: string, updater: (scene: Scene) => Scene) => {
    persistScenes(scenes.map((s) => (s.id === sceneId ? updater(s) : s)))
  }, [scenes, persistScenes])

  const switchCollection = useCallback((collectionId: string) => {
    if (!store.collections.some((c) => c.id === collectionId)) return
    persistStore({ ...store, activeCollectionId: collectionId })
    setSelectedSourceId(null)
  }, [persistStore, store])

  const addCollection = useCallback((name?: string) => {
    const id = freshId('col')
    const collection: SceneCollection = {
      id,
      name: name ?? `Collection ${store.collections.length + 1}`,
      scenes: [{ id: freshId('scene'), name: 'Scène 1', sources: [] }],
      activeSceneId: ''
    }
    collection.activeSceneId = collection.scenes[0].id
    persistStore({
      collections: [...store.collections, collection],
      activeCollectionId: id
    })
    setSelectedSourceId(null)
  }, [persistStore, store.collections])

  const removeCollection = useCallback((collectionId: string) => {
    if (store.collections.length <= 1) return
    const next = store.collections.filter((c) => c.id !== collectionId)
    const nextActiveId =
      store.activeCollectionId === collectionId ? next[0].id : store.activeCollectionId
    persistStore({ collections: next, activeCollectionId: nextActiveId })
    setSelectedSourceId(null)
  }, [persistStore, store])

  const renameCollection = useCallback((collectionId: string, name: string) => {
    const next = store.collections.map((c) =>
      c.id === collectionId ? { ...c, name: name.trim() || c.name } : c
    )
    persistStore({ ...store, collections: next })
  }, [persistStore, store])

  const duplicateCollection = useCallback((collectionId: string) => {
    const original = store.collections.find((c) => c.id === collectionId)
    if (!original) return
    const id = freshId('col')
    const scenesCopy = original.scenes.map((scene, si) => ({
      ...scene,
      id: freshId('scene'),
      sources: scene.sources.map((src, i) => ({
        ...src,
        id: `src-${Date.now()}-${si}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        transform: { ...src.transform }
      }))
    }))
    const copy: SceneCollection = {
      id,
      name: `${original.name} (copie)`,
      scenes: scenesCopy,
      activeSceneId: scenesCopy[0]?.id ?? ''
    }
    persistStore({
      collections: [...store.collections, copy],
      activeCollectionId: id
    })
    setSelectedSourceId(null)
  }, [persistStore, store.collections])

  const applyTemplate = useCallback(async (
    templateId: SceneTemplateId,
    mode: 'replace' | 'new' = 'replace',
    layout?: Pick<TemplateLayoutOptions, 'webcamDevice' | 'streamResolution'>
  ) => {
    const webcamSize = await probeWebcamResolution(layout?.webcamDevice)
    const fromTemplate = createCollectionFromTemplate(templateId, {
      webcamDevice: layout?.webcamDevice,
      streamResolution: layout?.streamResolution,
      webcamSize: webcamSize ?? undefined
    })
    if (mode === 'new') {
      persistStore({
        collections: [...store.collections, fromTemplate],
        activeCollectionId: fromTemplate.id
      })
    } else if (activeCollection) {
      const next = store.collections.map((col) =>
        col.id === activeCollection.id
          ? { ...fromTemplate, id: col.id, name: fromTemplate.name }
          : col
      )
      persistStore({ ...store, collections: next })
    } else {
      persistStore({
        collections: [fromTemplate],
        activeCollectionId: fromTemplate.id
      })
    }
    setSelectedSourceId(null)
  }, [activeCollection, persistStore, store])

  const addScene = useCallback(() => {
    const id = freshId('scene')
    persistScenes([...scenes, { id, name: `Scène ${scenes.length + 1}`, sources: [] }], id)
  }, [scenes, persistScenes])

  const removeScene = useCallback((sceneId: string) => {
    if (scenes.length <= 1) return
    const next = scenes.filter((s) => s.id !== sceneId)
    const nextActive = activeSceneId === sceneId ? next[0].id : activeSceneId
    persistScenes(next, nextActive)
  }, [scenes, activeSceneId, persistScenes])

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
    persistScenes(next)
  }, [scenes, persistScenes])

  const exportScenes = useCallback(() => {
    const payload = {
      version: 1,
      type: 'nova-stream-collection',
      exportedAt: new Date().toISOString(),
      collection: {
        name: activeCollection?.name ?? 'Collection',
        scenes
      }
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    const safeName = (activeCollection?.name ?? 'scenes').replace(/[^\w\-]+/g, '-')
    anchor.href = url
    anchor.download = `nova-stream-${safeName}-${stamp}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [activeCollection?.name, scenes])

  const exportAllCollections = useCallback(() => {
    const payload = {
      version: 1,
      type: 'nova-stream-collections',
      exportedAt: new Date().toISOString(),
      activeCollectionId: store.activeCollectionId,
      collections: store.collections
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    anchor.href = url
    anchor.download = `nova-stream-collections-${stamp}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [store])

  const importScenesFromJson = useCallback((json: string) => {
    const importedScenes = parseImportedScenes(json)
    persistScenes(importedScenes, importedScenes[0].id)
    setSelectedSourceId(null)
  }, [persistScenes])

  const importCollectionsFromJson = useCallback((json: string) => {
    const data = JSON.parse(json) as Record<string, unknown>
    if (data.type === 'nova-stream-collections' && Array.isArray(data.collections)) {
      const collections = (data.collections as SceneCollection[]).map((col) => ({
        ...col,
        id: col.id || freshId('col'),
        scenes: migrateScenes(col.scenes ?? [])
      }))
      if (collections.length === 0) throw new Error('Aucune collection dans le fichier')
      const activeCollectionId =
        typeof data.activeCollectionId === 'string' &&
        collections.some((c) => c.id === data.activeCollectionId)
          ? data.activeCollectionId
          : collections[0].id
      persistStore({ collections, activeCollectionId })
      setSelectedSourceId(null)
      return
    }
    importScenesFromJson(json)
  }, [importScenesFromJson, persistStore])

  const duplicateScene = useCallback((sceneId: string) => {
    const original = scenes.find((s) => s.id === sceneId)
    if (!original) return
    const id = freshId('scene')
    const copy: Scene = {
      id,
      name: `${original.name} (copie)`,
      sources: original.sources.map((src, i) => ({
        ...src,
        id: `src-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        transform: { ...src.transform }
      }))
    }
    persistScenes([...scenes, copy], id)
  }, [scenes, persistScenes])

  const addSource = useCallback((type: SourceType, extra?: Partial<Source>): Source | null => {
    if (!activeScene) return null
    const source = { ...createSource(type), ...extra }
    updateScene(activeScene.id, (s) => ({
      ...s,
      sources: [...s.sources, source]
    }))
    setSelectedSourceId(source.id)
    return source
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
      sources: s.sources.map((src) => {
        if (src.id !== sourceId) return src
        const next: Source = { ...src, ...partial }
        if (partial.transform) {
          next.transform = { ...src.transform, ...partial.transform }
        }
        if (partial.chromaKey) {
          next.chromaKey = { ...src.chromaKey, ...partial.chromaKey } as Source['chromaKey']
        }
        return next
      })
    }))
  }, [activeScene, updateScene])

  const duplicateSource = useCallback((sourceId: string) => {
    if (!activeScene) return
    const original = activeScene.sources.find((s) => s.id === sourceId)
    if (!original) return
    const copy: Source = {
      ...original,
      id: freshId('src'),
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

  const applyWebWidgetSettings = useCallback((settings: WebWidgetSettings) => {
    persistScenes(applyWebWidgetSettingsToScenes(scenes, settings))
  }, [scenes, persistScenes])

  const selectedSource = activeScene?.sources.find((s) => s.id === selectedSourceId) ?? null

  return {
    scenes,
    collections: store.collections,
    activeCollection,
    activeScene,
    activeSceneId,
    setActiveSceneId,
    selectedSource,
    selectedSourceId,
    setSelectedSourceId: selectSource,
    switchCollection,
    addCollection,
    removeCollection,
    renameCollection,
    duplicateCollection,
    applyTemplate,
    addScene,
    removeScene,
    renameScene,
    duplicateScene,
    moveScene,
    exportScenes,
    exportAllCollections,
    importScenesFromJson,
    importCollectionsFromJson,
    addSource,
    removeSource,
    updateSource,
    moveSource,
    duplicateSource,
    applyWebWidgetSettings
  }
}
