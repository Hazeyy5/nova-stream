;(function () {
  const META_PREFIX = 'nova_cloud_meta_'
  const DEBOUNCE_MS = 600

  let pushTimer = null

  function metaKey() {
    const uid = window.NovaAuth?.getSession()?.userId
    return uid ? `${META_PREFIX}${uid}` : null
  }

  function getMeta() {
    const key = metaKey()
    if (!key) return { localUpdatedAt: 0, cloudUpdatedAt: 0 }
    try {
      return JSON.parse(localStorage.getItem(key) || '{}')
    } catch {
      return { localUpdatedAt: 0, cloudUpdatedAt: 0 }
    }
  }

  function setMeta(partial) {
    const key = metaKey()
    if (!key) return
    localStorage.setItem(key, JSON.stringify({ ...getMeta(), ...partial }))
  }

  function apiBase() {
    return (window.NovaDonations?.apiUrl?.() || window.NOVA_CONFIG?.DONATIONS_API_URL || '').replace(/\/$/, '')
  }

  function authHeaders() {
    const session = window.NovaAuth?.getSession()
    if (!session?.accessToken) return null
    return {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json'
    }
  }

  async function pullFromCloud() {
    const base = apiBase()
    const session = window.NovaAuth?.getSession()
    const headers = authHeaders()
    if (!base || !session || !headers) return { pulled: false, reason: 'no_session' }

    const url = new URL(`${base}/v1/widget-settings`)
    url.searchParams.set('streamerId', session.userId)

    const res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(12000)
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      return { pulled: false, reason: data.message || 'fetch_failed' }
    }

    if (!data.settings || !data.updatedAt) {
      return { pulled: false, reason: 'empty' }
    }

    const meta = getMeta()
    const localTs = meta.localUpdatedAt || 0
    const cloudTs = data.updatedAt || 0

    if (cloudTs > localTs) {
      window.NovaWidgetSettings.saveAll(data.settings, { skipCloud: true })
      setMeta({ cloudUpdatedAt: cloudTs, localUpdatedAt: cloudTs })
      window.dispatchEvent(new CustomEvent('nova:cloud-sync', {
        detail: { direction: 'pull', at: cloudTs }
      }))
      return { pulled: true, at: cloudTs }
    }

    return { pulled: false, reason: 'local_newer' }
  }

  async function pushToCloud(settings) {
    const base = apiBase()
    const session = window.NovaAuth?.getSession()
    const headers = authHeaders()
    if (!base || !session || !headers) return { pushed: false, reason: 'no_session' }

    const res = await fetch(`${base}/v1/widget-settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        streamerId: session.userId,
        settings: settings ?? window.NovaWidgetSettings.loadAll()
      }),
      signal: AbortSignal.timeout(12000)
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      return { pushed: false, reason: data.message || 'push_failed' }
    }

    const now = data.updatedAt || Date.now()
    setMeta({ localUpdatedAt: now, cloudUpdatedAt: now })
    window.dispatchEvent(new CustomEvent('nova:cloud-sync', {
      detail: { direction: 'push', at: now }
    }))
    return { pushed: true, at: now }
  }

  function schedulePush(settings) {
    clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      void pushToCloud(settings)
    }, DEBOUNCE_MS)
  }

  async function init() {
    try {
      const pull = await pullFromCloud()
      if (!pull.pulled) {
        const local = window.NovaWidgetSettings?.loadAll?.()
        if (local && apiBase() && authHeaders()) {
          await pushToCloud(local)
        }
      }
    } catch {
      /* cloud optionnel */
    }
  }

  window.NovaWidgetCloud = {
    pullFromCloud,
    pushToCloud,
    schedulePush,
    init,
    getMeta
  }
})()
