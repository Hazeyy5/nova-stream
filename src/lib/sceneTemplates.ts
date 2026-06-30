import type { Scene, SceneCollection, Source, SourceType } from '../types'
import { createSource } from '../types'
import {
  adaptCollectionWebcamLayouts,
  type WebcamLayoutContext,
  type WebcamSlotAnchor
} from './webcamLayout'

export type SceneTemplateId = 'gaming' | 'just-chatting' | 'irl' | 'creative' | 'minimal'

export interface SceneTemplate {
  id: SceneTemplateId
  name: string
  description: string
  icon: string
  collectionName: string
  /** Scènes incluses dans le pack live. */
  liveScenes: string[]
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'Pack live complet : Starting Soon, gaming, chat, BRB et fin de stream.',
    icon: '🎮',
    collectionName: 'Pack Gaming',
    liveScenes: ['Starting Soon', 'GAMING', 'Just Chatting', 'BRB', 'Fin de stream']
  },
  {
    id: 'just-chatting',
    name: 'Just Chatting',
    description: 'Discussion, invité/colab, pauses et clôture — idéal talk show.',
    icon: '💬',
    collectionName: 'Pack Just Chatting',
    liveScenes: ['Starting Soon', 'Discussion', 'Invité / Colab', 'BRB', 'Fin de stream']
  },
  {
    id: 'irl',
    name: 'IRL',
    description: 'Mobile / extérieur avec webcam portrait et compteur viewers.',
    icon: '📱',
    collectionName: 'Pack IRL',
    liveScenes: ['Starting Soon', 'IRL Live', 'BRB', 'Fin de stream']
  },
  {
    id: 'creative',
    name: 'Créatif',
    description: 'Canvas navigateur, webcam et chat pour art, musique ou dev.',
    icon: '🎨',
    collectionName: 'Pack Créatif',
    liveScenes: ['Starting Soon', 'Création', 'BRB', 'Fin de stream']
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Scènes essentielles à personnaliser — Starting Soon et fin inclus.',
    icon: '✨',
    collectionName: 'Pack Minimal',
    liveScenes: ['Starting Soon', 'Live', 'BRB', 'Fin de stream']
  }
]

type SourceDef = {
  type: SourceType
  overrides?: Partial<Source>
  /** Ancrage de la webcam dans son emplacement (ajusté selon la résolution caméra). */
  webcamAnchor?: WebcamSlotAnchor
}

type SceneDef = { name: string; sources: SourceDef[] }

function freshId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function buildSources(defs: SourceDef[]): Source[] {
  return defs.map((def, index) => {
    const base = createSource(def.type, def.overrides?.name)
    const transform = {
      ...base.transform,
      ...(def.overrides?.transform ?? {}),
      zIndex: def.overrides?.transform?.zIndex ?? index
    }
    return {
      ...base,
      ...def.overrides,
      id: freshId('src'),
      transform,
      scaleMode: def.type === 'webcam'
        ? (def.overrides?.scaleMode ?? 'fit')
        : def.overrides?.scaleMode ?? base.scaleMode
    }
  })
}

function buildScene(name: string, sourceDefs: SourceDef[]): Scene {
  return {
    id: freshId('scene'),
    name,
    sources: buildSources(sourceDefs)
  }
}

function buildCollection(id: string, name: string, sceneDefs: SceneDef[]): SceneCollection {
  const scenes = sceneDefs.map((def) => buildScene(def.name, def.sources))
  return {
    id,
    name,
    scenes,
    activeSceneId: scenes[0]?.id ?? ''
  }
}

const STARTING_SOON_SCENE: SceneDef = {
  name: 'Starting Soon',
  sources: [
    {
      type: 'text',
      overrides: {
        name: 'Compte à rebours',
        textContent: '🔴 LIVE dans quelques instants…',
        transform: { x: 10, y: 32, width: 80, height: 28, zIndex: 10 }
      }
    },
    {
      type: 'followerGoal',
      overrides: {
        widgetLabel: 'Objectif followers',
        transform: { x: 30, y: 62, width: 40, height: 12, zIndex: 12 }
      }
    }
  ]
}

const ENDING_SCENE: SceneDef = {
  name: 'Fin de stream',
  sources: [
    {
      type: 'text',
      overrides: {
        name: 'Merci',
        textContent: 'Merci pour le stream ! À bientôt 💜',
        transform: { x: 10, y: 35, width: 80, height: 30, zIndex: 10 }
      }
    }
  ]
}

const GAMING_SCENES: SceneDef[] = [
  STARTING_SOON_SCENE,
  {
    name: 'GAMING',
    sources: [
      { type: 'game', overrides: { name: 'Jeu', transform: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 } } },
      { type: 'webcam', overrides: { name: 'CAM', visible: true }, webcamAnchor: 'bottom-right' },
      { type: 'chat', overrides: { chatStyle: 'neon', transform: { x: 1, y: 58, width: 30, height: 40, zIndex: 20 } } },
      { type: 'alert', overrides: { alertStyle: 'neon', transform: { x: 28, y: 4, width: 44, height: 20, zIndex: 25 } } },
      { type: 'viewerCount', overrides: { name: 'Spectateurs', transform: { x: 72, y: 2, width: 16, height: 10, zIndex: 24 } } }
    ]
  },
  {
    name: 'Just Chatting',
    sources: [
      { type: 'webcam', overrides: { name: 'CAM', transform: { x: 8, y: 10, width: 55, height: 78, zIndex: 5 } }, webcamAnchor: 'top-left' },
      { type: 'chat', overrides: { chatStyle: 'bubble', transform: { x: 66, y: 12, width: 32, height: 76, zIndex: 20 } } },
      { type: 'alert', overrides: { transform: { x: 30, y: 4, width: 40, height: 16, zIndex: 25 } } },
      { type: 'followerGoal', overrides: { widgetLabel: 'Objectif followers', transform: { x: 2, y: 2, width: 28, height: 12, zIndex: 22 } } }
    ]
  },
  {
    name: 'BRB',
    sources: [
      { type: 'text', overrides: { name: 'Pause', textContent: '⏸ Pause — je reviens bientôt !', transform: { x: 15, y: 38, width: 70, height: 24, zIndex: 10 } } }
    ]
  },
  ENDING_SCENE
]

const JUST_CHATTING_SCENES: SceneDef[] = [
  STARTING_SOON_SCENE,
  {
    name: 'Discussion',
    sources: [
      { type: 'webcam', overrides: { name: 'CAM', transform: { x: 6, y: 8, width: 58, height: 84, zIndex: 5 } }, webcamAnchor: 'top-left' },
      { type: 'chat', overrides: { chatStyle: 'bubble', transform: { x: 66, y: 10, width: 32, height: 80, zIndex: 20 } } },
      { type: 'alert', overrides: { alertStyle: 'banner', transform: { x: 20, y: 4, width: 60, height: 14, zIndex: 25 } } }
    ]
  },
  {
    name: 'Invité / Colab',
    sources: [
      { type: 'webcam', overrides: { name: 'Moi', transform: { x: 2, y: 58, width: 28, height: 38, zIndex: 10 } }, webcamAnchor: 'bottom-left' },
      { type: 'browser', overrides: { name: 'Contenu', browserUrl: 'https://twitch.tv', transform: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 } } },
      { type: 'chat', overrides: { chatStyle: 'minimal', transform: { x: 1, y: 62, width: 26, height: 36, zIndex: 20 } } }
    ]
  },
  {
    name: 'BRB',
    sources: [
      { type: 'text', overrides: { name: 'Pause', textContent: '⏸ Je reviens dans un instant…', transform: { x: 15, y: 38, width: 70, height: 24, zIndex: 10 } } }
    ]
  },
  ENDING_SCENE
]

const IRL_SCENES: SceneDef[] = [
  STARTING_SOON_SCENE,
  {
    name: 'IRL Live',
    sources: [
      { type: 'webcam', overrides: { name: 'CAM', transform: { x: 28, y: 5, width: 44, height: 88, zIndex: 5 }, scaleMode: 'fill' }, webcamAnchor: 'center' },
      { type: 'chat', overrides: { chatStyle: 'minimal', transform: { x: 2, y: 68, width: 24, height: 30, zIndex: 20 } } },
      { type: 'viewerCount', overrides: { transform: { x: 74, y: 2, width: 14, height: 10, zIndex: 24 } } }
    ]
  },
  {
    name: 'BRB',
    sources: [
      { type: 'text', overrides: { name: 'Pause', textContent: '⏸ Pause IRL', transform: { x: 20, y: 40, width: 60, height: 20, zIndex: 10 } } }
    ]
  },
  ENDING_SCENE
]

const CREATIVE_SCENES: SceneDef[] = [
  STARTING_SOON_SCENE,
  {
    name: 'Création',
    sources: [
      { type: 'browser', overrides: { name: 'Canvas', browserUrl: 'https://example.com', transform: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 } } },
      { type: 'webcam', overrides: { name: 'CAM', transform: { x: 74, y: 68, width: 24, height: 28, zIndex: 10 } }, webcamAnchor: 'bottom-right' },
      { type: 'chat', overrides: { chatStyle: 'classic', transform: { x: 1, y: 62, width: 26, height: 36, zIndex: 20 } } }
    ]
  },
  {
    name: 'BRB',
    sources: [
      { type: 'text', overrides: { name: 'Pause', textContent: '🎨 Pause créative — retour bientôt', transform: { x: 12, y: 38, width: 76, height: 24, zIndex: 10 } } }
    ]
  },
  ENDING_SCENE
]

const MINIMAL_SCENES: SceneDef[] = [
  STARTING_SOON_SCENE,
  {
    name: 'Live',
    sources: [
      { type: 'webcam', overrides: { name: 'CAM', transform: { x: 72, y: 68, width: 26, height: 28, zIndex: 5 } }, webcamAnchor: 'bottom-right' }
    ]
  },
  {
    name: 'BRB',
    sources: [
      { type: 'text', overrides: { name: 'Pause', textContent: '⏸ Pause', transform: { x: 20, y: 40, width: 60, height: 20, zIndex: 10 } } }
    ]
  },
  ENDING_SCENE
]

const TEMPLATE_SCENE_DEFS: Record<SceneTemplateId, SceneDef[]> = {
  gaming: GAMING_SCENES,
  'just-chatting': JUST_CHATTING_SCENES,
  irl: IRL_SCENES,
  creative: CREATIVE_SCENES,
  minimal: MINIMAL_SCENES
}

function buildWebcamAnchorMap(sceneDefs: SceneDef[]): Record<string, Record<string, WebcamSlotAnchor>> {
  const map: Record<string, Record<string, WebcamSlotAnchor>> = {}
  for (const scene of sceneDefs) {
    for (const def of scene.sources) {
      if (def.type !== 'webcam' || !def.webcamAnchor) continue
      const sourceName = def.overrides?.name ?? 'Webcam'
      if (!map[scene.name]) map[scene.name] = {}
      map[scene.name][sourceName] = def.webcamAnchor
    }
  }
  return map
}

function assignWebcamDevice(collection: SceneCollection, deviceName: string): SceneCollection {
  if (!deviceName.trim()) return collection
  return {
    ...collection,
    scenes: collection.scenes.map((scene) => ({
      ...scene,
      sources: scene.sources.map((source) =>
        source.type === 'webcam' ? { ...source, webcamDevice: deviceName.trim() } : source
      )
    }))
  }
}

export interface TemplateLayoutOptions {
  webcamDevice?: string
  streamResolution?: string
  webcamSize?: { width: number; height: number }
}

export function createCollectionFromTemplate(
  templateId: SceneTemplateId,
  layout?: TemplateLayoutOptions
): SceneCollection {
  const template = SCENE_TEMPLATES.find((t) => t.id === templateId) ?? SCENE_TEMPLATES[0]
  const sceneDefs = TEMPLATE_SCENE_DEFS[templateId]
  let collection = buildCollection(freshId('col'), template.collectionName, sceneDefs)

  const [canvasWidth, canvasHeight] = (layout?.streamResolution ?? '1920x1080').split('x').map(Number)
  const camW = layout?.webcamSize?.width ?? 0
  const camH = layout?.webcamSize?.height ?? 0

  if (camW > 0 && camH > 0 && canvasWidth > 0 && canvasHeight > 0) {
    const ctx: WebcamLayoutContext = {
      camWidth: camW,
      camHeight: camH,
      canvasWidth,
      canvasHeight
    }
    collection = adaptCollectionWebcamLayouts(collection, buildWebcamAnchorMap(sceneDefs), ctx)
  }

  if (layout?.webcamDevice) {
    collection = assignWebcamDevice(collection, layout.webcamDevice)
  }

  return collection
}

export function createBlankCollection(): SceneCollection {
  return buildCollection(freshId('col'), 'Ma collection', [{ name: 'Scène 1', sources: [] }])
}

export function createDefaultCollection(): SceneCollection {
  return createBlankCollection()
}
