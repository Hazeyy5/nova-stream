;(function () {
  const EMPTY_STATS = { viewerCount: 0, followerCount: 0, subCount: 0, live: false }

  function desktopBase() {
    return window.NOVA_CONFIG?.DESKTOP_LINK_URL || window.OVERLAY_DESKTOP || 'http://127.0.0.1:3847'
  }

  function formatCount(n) {
    return Math.max(0, Number(n) || 0).toLocaleString('fr-FR')
  }

  async function fetchFromDesktop() {
    try {
      const overlayToken = window.__novaOverlayToken || ''
      const q = overlayToken ? `?t=${encodeURIComponent(overlayToken)}` : ''
      const res = await fetch(`${desktopBase()}/api/widget-stats${q}`, {
        signal: AbortSignal.timeout(4000)
      })
      if (!res.ok) return null
      const data = await res.json()
      if (!data.success) return null
      return data
    } catch {
      return null
    }
  }

  async function fetchFromTwitchDirect() {
    const session = window.NovaAuth?.getSession?.()
    const clientId = window.NOVA_CONFIG?.TWITCH_CLIENT_ID
    if (!session?.accessToken || !session?.userId || !clientId) return null

    const headers = {
      Authorization: `Bearer ${session.accessToken}`,
      'Client-Id': clientId
    }
    const broadcasterId = encodeURIComponent(session.userId)

    try {
      const [streamRes, followersRes, subsRes] = await Promise.all([
        fetch(`https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`, { headers }),
        fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=1`, { headers }),
        fetch(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}&first=1`, { headers })
      ])

      let viewerCount = 0
      let live = false
      if (streamRes.ok) {
        const streamJson = await streamRes.json()
        const stream = streamJson.data?.[0]
        if (stream) {
          viewerCount = stream.viewer_count ?? 0
          live = true
        }
      }

      let followerCount = 0
      if (followersRes.ok) {
        const followersJson = await followersRes.json()
        followerCount = followersJson.total ?? 0
      }

      let subCount = 0
      if (subsRes.ok) {
        const subsJson = await subsRes.json()
        subCount = subsJson.total ?? 0
      }

      return {
        stats: { viewerCount, followerCount, subCount, live },
        chat: [],
        displayName: session.displayName,
        username: session.username
      }
    } catch {
      return null
    }
  }

  async function fetchLiveContext() {
    const desktop = await fetchFromDesktop()
    if (desktop) return desktop
    return fetchFromTwitchDirect()
  }

  function goalCurrent(cfg, kind, ctx) {
    const target = Math.max(1, cfg.target || 100)
    if (cfg.useLiveData === false) {
      const demoRatio = kind === 'followerGoal' ? 0.72 : 0.45
      return Math.max(0, Math.min(target - 1, Math.round(target * demoRatio)))
    }
    const stats = ctx?.stats ?? EMPTY_STATS
    const raw = kind === 'followerGoal' ? stats.followerCount : stats.subCount
    return Math.max(0, Math.min(target, Number(raw) || 0))
  }

  function viewerCountValue(cfg, ctx) {
    if (cfg.useLiveData === false) return '1 284'
    const stats = ctx?.stats ?? EMPTY_STATS
    return formatCount(stats.viewerCount)
  }

  function chatLines(cfg, ctx) {
    const max = Math.max(1, cfg.maxMessages || 6)
    const fromLive = (ctx?.chat ?? [])
      .filter((m) => m?.message)
      .slice(-max)
      .map((m) => ({
        user: m.username || 'Viewer',
        color: m.color || '#a78bfa',
        text: m.message
      }))

    if (fromLive.length > 0) return fromLive

    const name = ctx?.displayName || ctx?.username || 'Viewer'
    return [
      { user: name, color: '#9146FF', text: 'Salut le stream !' },
      { user: 'ModTeam', color: '#f472b6', text: 'Bienvenue 🎉' },
      { user: 'SubFan', color: '#34d399', text: 'GG pour le raid !' }
    ].slice(0, max)
  }

  function alertUser(ctx, fallback) {
    return ctx?.displayName || ctx?.username || fallback
  }

  let pollTimer = null
  let liveContext = null
  const listeners = new Set()

  function notify() {
    listeners.forEach((fn) => {
      try { fn(liveContext) } catch { /* ignore */ }
    })
  }

  async function refresh() {
    liveContext = await fetchLiveContext()
    notify()
    return liveContext
  }

  function subscribe(fn) {
    listeners.add(fn)
    if (liveContext) fn(liveContext)
    return () => listeners.delete(fn)
  }

  function startPolling(intervalMs = 15000) {
    if (pollTimer) return
    void refresh()
    pollTimer = setInterval(() => { void refresh() }, intervalMs)
  }

  function setOverlayToken(token) {
    window.__novaOverlayToken = token || ''
  }

  function stopPolling() {
    if (!pollTimer) return
    clearInterval(pollTimer)
    pollTimer = null
  }

  window.NovaTwitchLive = {
    EMPTY_STATS,
    formatCount,
    fetchLiveContext,
    refresh,
    subscribe,
    startPolling,
    stopPolling,
    goalCurrent,
    viewerCountValue,
    chatLines,
    alertUser,
    setOverlayToken,
    getContext: () => liveContext
  }
})()
