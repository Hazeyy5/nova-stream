import type { Scene, SceneCollection, Source, SourceType } from '../types'
import { createSource } from '../types'

export type SceneTemplateId = 'gaming' | 'just-chatting' | 'irl' | 'creative' | 'minimal'

export interface SceneTemplate {
  id: SceneTemplateId
  name: string
  description: string
  icon: string
  collectionName: string
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'Jeu plein écran, facecam, chat, alertes et compteur de spectateurs.',
    icon: '🎮',
    collectionName: 'Gaming'
  },
  {
    id: 'just-chatting',
    name: 'Just Chatting',
    description: 'Webcam mise en avant, chat en bulles et objectif followers.',
    icon: '💬',
    collectionName: 'Just Chatting'
  },
  {
    id: 'irl',
    name: 'IRL',
    description: 'Webcam portrait, chat minimal — idéal pour les streams mobiles.',
    icon: '📱',
    collectionName: 'IRL'
  },
  {
    id: 'creative',
    name: 'Créatif',
    description: 'Navigateur ou canvas, petite webcam et chat pour l\'art ou la musique.',
    icon: '🎨',
    collectionName: 'Créatif'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Une scène vide et une webcam — à personnaliser vous-même.',
    icon: '✨',
    collectionName: 'Minimal'
  }
]

type SourceDef = {
  type: SourceType
  overrides?: Partial<Source>
}

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
      transform
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

function buildCollection(id: string, name: string, sceneDefs: Array<{ name: string; sources: SourceDef[] }>): SceneCollection {
  const scenes = sceneDefs.map((def) => buildScene(def.name, def.sources))
  return {
    id,
    name,
    scenes,
    activeSceneId: scenes[0]?.id ?? ''
  }
}

const GAMING_SCENES: Array<{ name: string; sources: SourceDef[] }> = [
  {
    name: 'GAMING',
    sources: [
      { type: 'game', overrides: { name: 'Jeu', transform: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 } } },
      { type: 'webcam', overrides: { name: 'CAM', visible: true } },
      { type: 'chat', overrides: { chatStyle: 'neon', transform: { x: 1, y: 58, width: 30, height: 40, zIndex: 20 } } },
      { type: 'alert', overrides: { alertStyle: 'neon', transform: { x: 28, y: 4, width: 44, height: 20, zIndex: 25 } } },
      { type: 'viewerCount', overrides: { name: 'Spectateurs', transform: { x: 72, y: 2, width: 16, height: 10, zIndex: 24 } } }
    ]
  },
  {
    name: 'Just Chatting',
    sources: [
      { type: 'webcam', overrides: { name: 'CAM', transform: { x: 8, y: 10, width: 55, height: 78, zIndex: 5 } } },
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
  {
    name: 'Fin de stream',
    sources: [
      { type: 'text', overrides: { name: 'Merci', textContent: 'Merci pour le stream ! À bientôt 💜', transform: { x: 10, y: 35, width: 80, height: 30, zIndex: 10 } } }
    ]
  }
]

const JUST_CHATTING_SCENES: Array<{ name: string; sources: SourceDef[] }> = [
  {
    name: 'Discussion',
    sources: [
      { type: 'webcam', overrides: { name: 'CAM', transform: { x: 6, y: 8, width: 58, height: 84, zIndex: 5 } } },
      { type: 'chat', overrides: { chatStyle: 'bubble', transform: { x: 66, y: 10, width: 32, height: 80, zIndex: 20 } } },
      { type: 'alert', overrides: { alertStyle: 'banner', transform: { x: 20, y: 4, width: 60, height: 14, zIndex: 25 } } }
    ]
  },
  {
    name: 'Invité / Colab',
    sources: [
      { type: 'webcam', overrides: { name: 'Moi', transform: { x: 2, y: 58, width: 28, height: 38, zIndex: 10 } } },
      { type: 'browser', overrides: { name: 'Contenu', browserUrl: 'https://twitch.tv', transform: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 } } },
      { type: 'chat', overrides: { chatStyle: 'minimal', transform: { x: 1, y: 62, width: 26, height: 36, zIndex: 20 } } }
    ]
  },
  {
    name: 'BRB',
    sources: [
      { type: 'text', overrides: { name: 'Pause', textContent: '⏸ Je reviens dans un instant…', transform: { x: 15, y: 38, width: 70, height: 24, zIndex: 10 } } }
    ]
  }
]

const IRL_SCENES: Array<{ name: string; sources: SourceDef[] }> = [
  {
    name: 'IRL Live',
    sources: [
      { type: 'webcam', overrides: { name: 'CAM', transform: { x: 28, y: 5, width: 44, height: 88, zIndex: 5 }, scaleMode: 'fill' } },
      { type: 'chat', overrides: { chatStyle: 'minimal', transform: { x: 2, y: 68, width: 24, height: 30, zIndex: 20 } } },
      { type: 'viewerCount', overrides: { transform: { x: 74, y: 2, width: 14, height: 10, zIndex: 24 } } }
    ]
  },
  {
    name: 'BRB',
    sources: [
      { type: 'text', overrides: { name: 'Pause', textContent: '⏸ Pause IRL', transform: { x: 20, y: 40, width: 60, height: 20, zIndex: 10 } } }
    ]
  }
]

const CREATIVE_SCENES: Array<{ name: string; sources: SourceDef[] }> = [
  {
    name: 'Création',
    sources: [
      { type: 'browser', overrides: { name: 'Canvas', browserUrl: 'https://example.com', transform: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 } } },
      { type: 'webcam', overrides: { name: 'CAM', transform: { x: 74, y: 68, width: 24, height: 28, zIndex: 10 } } },
      { type: 'chat', overrides: { chatStyle: 'classic', transform: { x: 1, y: 62, width: 26, height: 36, zIndex: 20 } } }
    ]
  },
  {
    name: 'BRB',
    sources: [
      { type: 'text', overrides: { name: 'Pause', textContent: '🎨 Pause créative — retour bientôt', transform: { x: 12, y: 38, width: 76, height: 24, zIndex: 10 } } }
    ]
  }
]

const MINIMAL_SCENES: Array<{ name: string; sources: SourceDef[] }> = [
  {
    name: 'Scène vide',
    sources: []
  },
  {
    name: 'Webcam',
    sources: [
      { type: 'webcam', overrides: { name: 'CAM', transform: { x: 72, y: 68, width: 26, height: 28, zIndex: 5 } } }
    ]
  }
]

const TEMPLATE_SCENE_DEFS: Record<SceneTemplateId, Array<{ name: string; sources: SourceDef[] }>> = {
  gaming: GAMING_SCENES,
  'just-chatting': JUST_CHATTING_SCENES,
  irl: IRL_SCENES,
  creative: CREATIVE_SCENES,
  minimal: MINIMAL_SCENES
}

export function createCollectionFromTemplate(templateId: SceneTemplateId): SceneCollection {
  const template = SCENE_TEMPLATES.find((t) => t.id === templateId) ?? SCENE_TEMPLATES[0]
  return buildCollection(freshId('col'), template.collectionName, TEMPLATE_SCENE_DEFS[templateId])
}

export function createBlankCollection(): SceneCollection {
  return buildCollection(freshId('col'), 'Ma collection', [{ name: 'Scène 1', sources: [] }])
}

export function createDefaultCollection(): SceneCollection {
  return createBlankCollection()
}
