;(function () {
  const STORAGE_PREFIX = 'nova_widget_settings_'

  const DEFAULTS = {
    alert: {
      enabled: true,
      style: 'classic',
      animation: 'pop',
      durationSec: 5,
      types: { follow: true, sub: true, donation: true, raid: true }
    },
    chat: {
      enabled: true,
      style: 'classic',
      maxMessages: 6
    },
    followerGoal: {
      enabled: true,
      style: 'classic',
      label: 'Objectif followers',
      target: 100,
      useLiveData: true
    },
    subGoal: {
      enabled: true,
      style: 'classic',
      label: 'Objectif abonnés',
      target: 50,
      useLiveData: true
    },
    viewerCount: {
      enabled: true,
      style: 'classic',
      label: 'Spectateurs',
      useLiveData: true
    },
    poll: {
      enabled: true,
      style: 'bars',
      question: 'Quel est votre jeu préféré ?',
      options: ['RPG', 'FPS', 'Stratégie']
    }
  }

  function storageKey() {
    const session = window.NovaAuth?.getSession()
    return session?.userId ? `${STORAGE_PREFIX}${session.userId}` : null
  }

  function loadAll() {
    const key = storageKey()
    if (!key) return structuredClone(DEFAULTS)
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return structuredClone(DEFAULTS)
      const parsed = JSON.parse(raw)
      return mergeDefaults(DEFAULTS, parsed)
    } catch {
      return structuredClone(DEFAULTS)
    }
  }

  function mergeDefaults(defaults, saved) {
    const out = structuredClone(defaults)
    for (const [widget, def] of Object.entries(defaults)) {
      if (saved[widget] && typeof saved[widget] === 'object') {
        out[widget] = { ...def, ...saved[widget] }
        if (def.types && saved[widget].types) {
          out[widget].types = { ...def.types, ...saved[widget].types }
        }
        if (Array.isArray(def.options) && Array.isArray(saved[widget].options)) {
          out[widget].options = saved[widget].options
        }
      }
    }
    return out
  }

  function saveAll(settings) {
    const key = storageKey()
    if (!key) throw new Error('Session requise')
    localStorage.setItem(key, JSON.stringify(settings))
    return settings
  }

  function saveWidget(widgetId, partial) {
    const all = loadAll()
    all[widgetId] = { ...all[widgetId], ...partial }
    if (partial.types) {
      all[widgetId].types = { ...all[widgetId].types, ...partial.types }
    }
    return saveAll(all)
  }

  function getWidget(widgetId) {
    const all = loadAll()
    return all[widgetId] ? structuredClone(all[widgetId]) : null
  }

  async function syncToDesktop() {
    if (!window.NovaLink?.checkDesktopOnline) return { synced: false }
    const status = await NovaLink.checkDesktopOnline()
    if (!status?.online) return { synced: false, reason: 'offline' }

    const res = await fetch(`${window.NOVA_CONFIG.DESKTOP_LINK_URL}/api/widget-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: loadAll() })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Synchronisation échouée')
    }
    return { synced: true }
  }

  window.NovaWidgetSettings = {
    DEFAULTS,
    loadAll,
    saveAll,
    saveWidget,
    getWidget,
    syncToDesktop
  }
})()
