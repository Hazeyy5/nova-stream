;(function () {
  const params = new URLSearchParams(location.search)
  const widget = params.get('w') || window.OVERLAY_WIDGET || 'alert'
  const token = params.get('t') || window.OVERLAY_TOKEN || ''
  const cfgParam = params.get('cfg')

  function decodeCfg(raw) {
    if (!raw) return null
    try {
      let s = raw.replace(/-/g, '+').replace(/_/g, '/')
      while (s.length % 4) s += '='
      return JSON.parse(decodeURIComponent(escape(atob(s))))
    } catch {
      return null
    }
  }

  async function loadConfig() {
    const fromUrl = decodeCfg(cfgParam)
    if (fromUrl) return fromUrl

    try {
      const base = window.OVERLAY_DESKTOP || 'http://127.0.0.1:3847'
      const res = await fetch(
        `${base}/api/widget-config?widget=${encodeURIComponent(widget)}&t=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(2500) }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.config) return data.config
      }
    } catch { /* desktop offline */ }

    return null
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  }

  function renderAlert(root, cfg) {
    root.innerHTML = `
      <div class="alert-preview alert-style-${cfg.style || 'classic'} alert-playing" style="--alert-color:#9146FF">
        <div class="alert-preview-inner">
          <span class="alert-preview-icon">💜</span>
          <div class="alert-preview-text">
            <strong>NovaViewer</strong>
            <span>Nouveau follower</span>
          </div>
        </div>
      </div>
    `
  }

  function renderChat(root, cfg) {
    const lines = [
      { user: 'ViewerOne', color: '#a78bfa', text: 'Salut le stream !' },
      { user: 'ModTeam', color: '#f472b6', text: 'Bienvenue 🎉' }
    ].slice(0, Math.max(1, cfg.maxMessages || 6))
    root.innerHTML = `
      <div class="chat-preview chat-style-${cfg.style || 'classic'}">
        ${lines.map((l) =>
          `<div class="chat-line"><span class="chat-user" style="color:${l.color}">${l.user}</span><span class="chat-text">${l.text}</span></div>`
        ).join('')}
      </div>
    `
  }

  function renderGoal(root, cfg, accent) {
    const target = Math.max(1, cfg.target || 100)
    const current = Math.round(target * 0.72)
    const pct = Math.min(100, Math.round((current / target) * 100))
    root.innerHTML = `
      <div class="w-preview-root goal-preview goal-style-${cfg.style || 'classic'} ${accent}">
        <div class="w-preview-box">
          <span class="w-preview-label">${esc((cfg.label || 'Objectif').toUpperCase())}</span>
          <div class="w-preview-bar-track"><div class="w-preview-bar-fill" style="width:${pct}%"></div></div>
          <span class="w-preview-stat">${current} / ${target}</span>
        </div>
      </div>
    `
  }

  function renderViewer(root, cfg) {
    root.innerHTML = `
      <div class="w-preview-root viewer-preview viewer-style-${cfg.style || 'neon'}">
        <div class="w-preview-box viewer-box">
          <span class="w-preview-label">👁 ${esc((cfg.label || 'Spectateurs').toUpperCase())}</span>
          <span class="w-preview-count">1 284</span>
        </div>
      </div>
    `
  }

  function renderPoll(root, cfg) {
    const opts = (cfg.options || ['Option A', 'Option B']).filter(Boolean)
    root.innerHTML = `
      <div class="w-preview-root poll-preview poll-style-${cfg.style || 'bars'}">
        <div class="w-preview-box poll-box">
          <span class="w-preview-tag">📊 SONDAGE</span>
          <span class="w-preview-question">${esc(cfg.question || 'Question')}</span>
          <div class="w-preview-poll-rows">
            ${opts.map((o, i) => {
              const pct = [40, 28, 18][i] ?? 12
              return `
                <div class="w-preview-poll-row">
                  <div class="w-preview-poll-row-head"><span>${esc(o)}</span><span class="w-preview-poll-pct">${pct}%</span></div>
                  <div class="w-preview-bar-track w-preview-poll-track"><div class="w-preview-bar-fill w-preview-poll-fill" style="width:${pct}%"></div></div>
                </div>
              `
            }).join('')}
          </div>
        </div>
      </div>
    `
  }

  async function init() {
    const root = document.getElementById('overlay-root')
    if (!root) return
    const cfg = (await loadConfig()) || {}

    switch (widget) {
      case 'alert': renderAlert(root, cfg); break
      case 'chat': renderChat(root, cfg); break
      case 'followerGoal': renderGoal(root, cfg, 'accent-purple'); break
      case 'subGoal': renderGoal(root, cfg, 'accent-gold'); break
      case 'viewerCount': renderViewer(root, cfg); break
      case 'poll': renderPoll(root, cfg); break
      default:
        root.innerHTML = '<p style="color:#fff">Widget inconnu</p>'
    }
  }

  init()
})()
