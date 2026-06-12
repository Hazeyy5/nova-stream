import type { Scene, Source, WebWidgetSettings } from '../types'

function patchSource(source: Source, settings: WebWidgetSettings): Source {
  switch (source.type) {
    case 'alert': {
      const w = settings.alert
      if (!w) return source
      return {
        ...source,
        alertStyle: w.style ?? source.alertStyle,
        alertAnimation: w.animation ?? source.alertAnimation
      }
    }
    case 'chat': {
      const w = settings.chat
      if (!w) return source
      return {
        ...source,
        chatStyle: w.style ?? source.chatStyle,
        chatMaxMessages: w.maxMessages ?? source.chatMaxMessages
      }
    }
    case 'followerGoal': {
      const w = settings.followerGoal
      if (!w) return source
      return {
        ...source,
        goalStyle: w.style ?? source.goalStyle,
        widgetLabel: w.label ?? source.widgetLabel,
        widgetGoalTarget: w.target ?? source.widgetGoalTarget,
        widgetUseLiveData: w.useLiveData ?? source.widgetUseLiveData
      }
    }
    case 'subGoal': {
      const w = settings.subGoal
      if (!w) return source
      return {
        ...source,
        goalStyle: w.style ?? source.goalStyle,
        widgetLabel: w.label ?? source.widgetLabel,
        widgetGoalTarget: w.target ?? source.widgetGoalTarget,
        widgetUseLiveData: w.useLiveData ?? source.widgetUseLiveData
      }
    }
    case 'viewerCount': {
      const w = settings.viewerCount
      if (!w) return source
      return {
        ...source,
        goalStyle: w.style ?? source.goalStyle,
        widgetLabel: w.label ?? source.widgetLabel,
        widgetUseLiveData: w.useLiveData ?? source.widgetUseLiveData
      }
    }
    case 'poll': {
      const w = settings.poll
      if (!w) return source
      return {
        ...source,
        pollStyle: w.style ?? source.pollStyle,
        pollQuestion: w.question ?? source.pollQuestion,
        pollOptions: w.options?.length ? w.options : source.pollOptions
      }
    }
    default:
      return source
  }
}

export function applyWebWidgetSettingsToScenes(scenes: Scene[], settings: WebWidgetSettings): Scene[] {
  return scenes.map((scene) => ({
    ...scene,
    sources: scene.sources.map((source) => patchSource(source, settings))
  }))
}
