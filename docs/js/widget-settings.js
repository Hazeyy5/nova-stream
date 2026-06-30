;(function () {
  const STORAGE_PREFIX = 'nova_widget_settings_'

  const DEFAULTS = {
    alert: {
      enabled: true,
      style: 'classic',
      animation: 'pop',
      durationSec: 5,
      types: { follow: true, sub: true, donation: true, raid: true, bits: true },
      soundEnabled: true,
      soundVolume: 80,
      sounds: { follow: '', sub: '', donation: '', raid: '', bits: '' }
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
    },
    donations: {
      enabled: false,
      currency: 'EUR',
      minAmount: 1,
      suggestedAmounts: [1, 3, 5, 10, 20],
      pageMessage: 'Soutenez le stream et laissez un message !',
      thankYouMessage: 'Merci pour votre générosité !',
      alertTitle: 'Don',
      alertDefaultMessage: 'Merci pour votre soutien !',
      alertMessageTemplate: '{amount} — {message}',
      donationKey: '',
      paypalUsername: ''
    },
    tts: {
      enabled: false,
      rewardId: '',
      rewardTitle: '',
      rewardCost: 500,
      voiceName: '',
      rate: 1,
      pitch: 1,
      volume: 85,
      maxLength: 200,
      cooldownSec: 15,
      prefixTemplate: '{name} dit : {message}',
      blockedWords: [],
      requireLive: false
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
        if (def.sounds && saved[widget].sounds) {
          out[widget].sounds = { ...def.sounds, ...saved[widget].sounds }
        }
        if (Array.isArray(def.options) && Array.isArray(saved[widget].options)) {
          out[widget].options = saved[widget].options
        }
        if (Array.isArray(def.blockedWords) && Array.isArray(saved[widget].blockedWords)) {
          out[widget].blockedWords = saved[widget].blockedWords
        }
      }
    }
    return out
  }

  function saveAll(settings, opts = {}) {
    const key = storageKey()
    if (!key) throw new Error('Session requise')
    localStorage.setItem(key, JSON.stringify(settings))
    if (!opts.skipCloud && window.NovaWidgetCloud?.schedulePush) {
      window.NovaWidgetCloud.schedulePush(settings)
    }
    if (window.NovaDesktopSync?.scheduleAutoSync) {
      window.NovaDesktopSync.scheduleAutoSync()
    }
    return settings
  }

  function saveWidget(widgetId, partial) {
    const all = loadAll()
    all[widgetId] = { ...all[widgetId], ...partial }
    if (partial.types) {
      all[widgetId].types = { ...all[widgetId].types, ...partial.types }
    }
    if (partial.sounds) {
      all[widgetId].sounds = { ...all[widgetId].sounds, ...partial.sounds }
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
      body: JSON.stringify({ settings: loadAll(), widgetToken: getWidgetToken() })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Synchronisation échouée')
    }
    return { synced: true }
  }

  function getWidgetToken() {
    const session = window.NovaAuth?.getSession()
    if (!session?.userId) return null
    const key = `nova_widget_token_${session.userId}`
    let token = localStorage.getItem(key)
    if (!token) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
        b.toString(16).padStart(2, '0')
      ).join('')
      localStorage.setItem(key, token)
    }
    return token
  }

  function encodeCfg(obj) {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(obj ?? {}))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    } catch {
      return ''
    }
  }

  function getModuleUrls(widgetId, cfgOverride) {
    const token = getWidgetToken()
    const uid = window.NovaAuth?.getSession()?.userId ?? ''
    const cfg = cfgOverride ?? getWidget(widgetId) ?? DEFAULTS[widgetId] ?? {}
    const cfgParam = encodeCfg(cfg)
    const desktop = window.NOVA_CONFIG.DESKTOP_LINK_URL.replace(/\/$/, '')
    const web = window.NOVA_CONFIG.WEBSITE_URL.replace(/\/$/, '')
    const q = `t=${encodeURIComponent(token ?? '')}&uid=${encodeURIComponent(uid)}&cfg=${cfgParam}`
    return {
      local: `${desktop}/overlay/${widgetId}?t=${encodeURIComponent(token ?? '')}`,
      web: `${web}/overlays/widget.html?w=${encodeURIComponent(widgetId)}&${q}`
    }
  }

  window.NovaWidgetSettings = {
    DEFAULTS,
    loadAll,
    saveAll,
    saveWidget,
    getWidget,
    syncToDesktop,
    getWidgetToken,
    getModuleUrls
  }
})()
