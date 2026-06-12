;(function () {
  const ALERT_TYPES = [
    { id: 'follow', label: 'Followers', icon: '💜', user: 'NovaFan42', msg: 'Nouveau follower', color: '#9146FF' },
    { id: 'sub', label: 'Abonnements', icon: '⭐', user: 'SubLover', msg: "Merci pour le sub !", color: '#f1c40f' },
    { id: 'donation', label: 'Dons', icon: '💰', user: 'GenerousOne', msg: '5 € — Super stream !', color: '#2ecc71' },
    { id: 'raid', label: 'Raids', icon: '🚀', user: 'RaidSquad', msg: 'Raid avec 128 viewers', color: '#e74c3c' }
  ]

  const WIDGET_META = {
    alert: {
      title: "Fenêtre d'alerte",
      desc: 'Personnalisez l\'apparence des alertes follow, sub, don et raid affichées sur vos scènes Nova Stream.'
    },
    chat: {
      title: 'Fenêtre de chat',
      desc: 'Configurez le design et le nombre de messages visibles dans votre Chat Box.'
    },
    followerGoal: {
      title: 'Objectif followers',
      desc: 'Barre de progression alimentée par les stats Twitch en direct.'
    },
    subGoal: {
      title: 'Objectif abonnés',
      desc: 'Suivez vos abonnements avec une barre de progression personnalisable.'
    },
    viewerCount: {
      title: 'Compteur de spectateurs',
      desc: 'Affiche le nombre de viewers en temps réel pendant le live.'
    },
    poll: {
      title: 'Sondage',
      desc: 'Widget sondage avec options et résultats visuels sur scène.'
    }
  }

  function getWidgetId() {
    return new URLSearchParams(location.search).get('w') || 'alert'
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  }

  function renderAlertPreview(cfg, typeId) {
    const t = ALERT_TYPES.find((a) => a.id === typeId) || ALERT_TYPES[0]
    const el = document.getElementById('widget-preview')
    if (!el) return
    el.className = `widget-preview-stage alert-preview alert-style-${cfg.style || 'classic'} alert-anim-${cfg.animation || 'pop'}`
    el.innerHTML = `
      <div class="alert-preview-inner">
        <span class="alert-preview-icon">${t.icon}</span>
        <div class="alert-preview-text">
          <strong>${esc(t.user)}</strong>
          <span>${esc(t.msg)}</span>
        </div>
      </div>
    `
    el.style.setProperty('--alert-color', t.color)
    void el.offsetWidth
    el.classList.add('alert-playing')
    setTimeout(() => el.classList.remove('alert-playing'), 600)
  }

  function renderChatPreview(cfg) {
    const el = document.getElementById('widget-preview')
    if (!el) return
    const lines = [
      { user: 'ViewerOne', color: '#a78bfa', text: 'Salut le stream !' },
      { user: 'ModTeam', color: '#f472b6', text: 'Bienvenue 🎉' },
      { user: 'SubFan', color: '#34d399', text: 'GG pour le raid !' }
    ].slice(0, Math.max(1, cfg.maxMessages || 6))
    el.className = `widget-preview-stage chat-preview chat-style-${cfg.style || 'classic'}`
    el.innerHTML = lines.map(
      (l) => `<div class="chat-line"><span class="chat-user" style="color:${l.color}">${l.user}</span><span class="chat-text">${l.text}</span></div>`
    ).join('')
  }

  function renderGoalPreview(cfg, kind) {
    const el = document.getElementById('widget-preview')
    if (!el) return
    const current = kind === 'followerGoal' ? 72 : 45
    const target = cfg.target || 100
    const pct = Math.min(100, Math.round((current / target) * 100))
    el.className = 'widget-preview-stage widget-preview-goal'
    el.innerHTML = `
      <div class="goal-mock goal-style-${cfg.style || 'classic'}">
        <span class="widget-label">${esc(cfg.label)}</span>
        <div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div>
        <span class="widget-stat">${current} / ${target}</span>
      </div>
    `
  }

  function renderViewerPreview(cfg) {
    const el = document.getElementById('widget-preview')
    if (!el) return
    el.className = 'widget-preview-stage widget-preview-viewer'
    el.innerHTML = `
      <div class="viewer-mock goal-style-${cfg.style || 'classic'}">
        <span class="widget-label">${esc(cfg.label)}</span>
        <span class="viewer-count">1 284</span>
        <span class="viewer-live">● LIVE</span>
      </div>
    `
  }

  function renderPollPreview(cfg) {
    const el = document.getElementById('widget-preview')
    if (!el) return
    const opts = (cfg.options || []).slice(0, 4)
    const votes = [12, 28, 9, 5]
    el.className = 'widget-preview-stage widget-preview-poll'
    el.innerHTML = `
      <div class="poll-mock poll-style-${cfg.style || 'bars'}">
        <span class="widget-label">${esc(cfg.question)}</span>
        ${opts.map((o, i) => `
          <div class="poll-option">
            <span>${esc(o)}</span>
            <div class="poll-bar-wrap"><div class="poll-bar" style="width:${votes[i] ?? 10}%"></div></div>
          </div>
        `).join('')}
      </div>
    `
  }

  function updatePreview(widgetId, cfg, alertType) {
    switch (widgetId) {
      case 'alert': renderAlertPreview(cfg, alertType); break
      case 'chat': renderChatPreview(cfg); break
      case 'followerGoal': renderGoalPreview(cfg, 'followerGoal'); break
      case 'subGoal': renderGoalPreview(cfg, 'subGoal'); break
      case 'viewerCount': renderViewerPreview(cfg); break
      case 'poll': renderPollPreview(cfg); break
    }
  }

  function fieldToggle(id, label, checked) {
    return `
      <label class="cfg-field cfg-toggle">
        <span>${label}</span>
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} />
        <span class="cfg-toggle-track"></span>
      </label>
    `
  }

  function fieldSelect(id, label, options, value) {
    return `
      <label class="cfg-field">
        <span>${label}</span>
        <select id="${id}">
          ${options.map((o) => `<option value="${o.value}"${o.value === value ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </label>
    `
  }

  function fieldRange(id, label, min, max, value, suffix = '') {
    return `
      <label class="cfg-field">
        <span>${label} <output for="${id}">${value}${suffix}</output></span>
        <input type="range" id="${id}" min="${min}" max="${max}" value="${value}" />
      </label>
    `
  }

  function fieldText(id, label, value, placeholder = '') {
    return `
      <label class="cfg-field">
        <span>${label}</span>
        <input type="text" id="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}" />
      </label>
    `
  }

  function fieldNumber(id, label, value, min, max) {
    return `
      <label class="cfg-field">
        <span>${label}</span>
        <input type="number" id="${id}" value="${value}" min="${min}" max="${max}" />
      </label>
    `
  }

  function renderForm(widgetId, cfg) {
    switch (widgetId) {
      case 'alert':
        return `
          ${fieldToggle('cfg-enabled', 'Activé', cfg.enabled !== false)}
          <div class="cfg-subsection">
            <p class="cfg-subtitle">Types d'alertes</p>
            ${ALERT_TYPES.map((t) => fieldToggle(`cfg-type-${t.id}`, t.label, cfg.types?.[t.id] !== false)).join('')}
          </div>
          ${fieldSelect('cfg-style', 'Style visuel', [
            { value: 'classic', label: 'Classique' },
            { value: 'minimal', label: 'Minimal' },
            { value: 'neon', label: 'Néon' },
            { value: 'banner', label: 'Bannière' },
            { value: 'celebration', label: 'Célébration' },
            { value: 'sleek', label: 'Épuré' }
          ], cfg.style)}
          ${fieldSelect('cfg-animation', 'Animation', [
            { value: 'pop', label: 'Pop (rebond)' },
            { value: 'slideUp', label: 'Glissée vers le haut' },
            { value: 'slideLeft', label: 'Glissée depuis la gauche' },
            { value: 'bounce', label: 'Rebond élastique' },
            { value: 'fadeScale', label: 'Fondu + zoom' },
            { value: 'pulse', label: 'Pulsation' }
          ], cfg.animation)}
          ${fieldRange('cfg-duration', 'Durée affichage', 3, 10, cfg.durationSec || 5, 's')}
        `
      case 'chat':
        return `
          ${fieldToggle('cfg-enabled', 'Activé', cfg.enabled !== false)}
          ${fieldSelect('cfg-style', 'Design du chat', [
            { value: 'classic', label: 'Classique' },
            { value: 'minimal', label: 'Minimal' },
            { value: 'neon', label: 'Néon' },
            { value: 'bubble', label: 'Bulles' },
            { value: 'retro', label: 'Rétro' }
          ], cfg.style)}
          ${fieldRange('cfg-maxMessages', 'Messages visibles', 1, 12, cfg.maxMessages || 6, '')}
        `
      case 'followerGoal':
      case 'subGoal':
        return `
          ${fieldToggle('cfg-enabled', 'Activé', cfg.enabled !== false)}
          ${fieldText('cfg-label', 'Libellé', cfg.label)}
          ${fieldNumber('cfg-target', 'Objectif', cfg.target, 1, 999999)}
          ${fieldSelect('cfg-style', 'Style', [
            { value: 'classic', label: 'Classique' },
            { value: 'bar', label: 'Barre' },
            { value: 'minimal', label: 'Minimal' },
            { value: 'neon', label: 'Néon' }
          ], cfg.style)}
          ${fieldToggle('cfg-useLiveData', 'Données Twitch en direct', cfg.useLiveData !== false)}
        `
      case 'viewerCount':
        return `
          ${fieldToggle('cfg-enabled', 'Activé', cfg.enabled !== false)}
          ${fieldText('cfg-label', 'Libellé', cfg.label)}
          ${fieldSelect('cfg-style', 'Style', [
            { value: 'classic', label: 'Classique' },
            { value: 'bar', label: 'Barre' },
            { value: 'minimal', label: 'Minimal' },
            { value: 'neon', label: 'Néon' }
          ], cfg.style)}
          ${fieldToggle('cfg-useLiveData', 'Données Twitch en direct', cfg.useLiveData !== false)}
        `
      case 'poll':
        return `
          ${fieldToggle('cfg-enabled', 'Activé', cfg.enabled !== false)}
          ${fieldText('cfg-question', 'Question', cfg.question)}
          ${fieldText('cfg-opt0', 'Option 1', cfg.options?.[0] ?? '')}
          ${fieldText('cfg-opt1', 'Option 2', cfg.options?.[1] ?? '')}
          ${fieldText('cfg-opt2', 'Option 3', cfg.options?.[2] ?? '')}
          ${fieldSelect('cfg-style', 'Style', [
            { value: 'bars', label: 'Barres' },
            { value: 'classic', label: 'Classique' }
          ], cfg.style)}
        `
      default:
        return '<p>Widget inconnu.</p>'
    }
  }

  function readForm(widgetId) {
    const g = (id) => document.getElementById(id)
    switch (widgetId) {
      case 'alert': {
        const types = {}
        ALERT_TYPES.forEach((t) => { types[t.id] = g(`cfg-type-${t.id}`)?.checked !== false })
        return {
          enabled: g('cfg-enabled')?.checked !== false,
          style: g('cfg-style')?.value || 'classic',
          animation: g('cfg-animation')?.value || 'pop',
          durationSec: parseInt(g('cfg-duration')?.value || '5', 10),
          types
        }
      }
      case 'chat':
        return {
          enabled: g('cfg-enabled')?.checked !== false,
          style: g('cfg-style')?.value || 'classic',
          maxMessages: parseInt(g('cfg-maxMessages')?.value || '6', 10)
        }
      case 'followerGoal':
      case 'subGoal':
        return {
          enabled: g('cfg-enabled')?.checked !== false,
          label: g('cfg-label')?.value?.trim() || '',
          target: parseInt(g('cfg-target')?.value || '100', 10),
          style: g('cfg-style')?.value || 'classic',
          useLiveData: g('cfg-useLiveData')?.checked !== false
        }
      case 'viewerCount':
        return {
          enabled: g('cfg-enabled')?.checked !== false,
          label: g('cfg-label')?.value?.trim() || '',
          style: g('cfg-style')?.value || 'classic',
          useLiveData: g('cfg-useLiveData')?.checked !== false
        }
      case 'poll':
        return {
          enabled: g('cfg-enabled')?.checked !== false,
          question: g('cfg-question')?.value?.trim() || '',
          options: [0, 1, 2].map((i) => g(`cfg-opt${i}`)?.value?.trim()).filter(Boolean),
          style: g('cfg-style')?.value || 'bars'
        }
      default:
        return {}
    }
  }

  function bindFormEvents(widgetId, cfg, alertTypeRef) {
    const form = document.getElementById('widget-form')
    if (!form) return

    form.querySelectorAll('input, select').forEach((el) => {
      el.addEventListener('input', () => {
        const next = readForm(widgetId)
        updatePreview(widgetId, next, alertTypeRef.current)
        if (el.type === 'range') {
          const out = el.parentElement?.querySelector('output')
          if (out) out.textContent = el.value + (el.id === 'cfg-duration' ? 's' : '')
        }
      })
      el.addEventListener('change', () => {
        updatePreview(widgetId, readForm(widgetId), alertTypeRef.current)
      })
    })

    if (widgetId === 'alert') {
      document.querySelectorAll('[data-alert-type]').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-alert-type]').forEach((b) => b.classList.remove('active'))
          btn.classList.add('active')
          alertTypeRef.current = btn.dataset.alertType
          updatePreview(widgetId, readForm(widgetId), alertTypeRef.current)
        })
      })
    }
  }

  async function init() {
    const widgetId = getWidgetId()
    const meta = WIDGET_META[widgetId]
    if (!meta) {
      location.href = NovaAuth.asset('/dashboard.html')
      return
    }

    NovaDash.mountLayout({ activeId: widgetId })

    document.getElementById('widget-title').textContent = meta.title
    document.getElementById('widget-desc').textContent = meta.desc

    let cfg = NovaWidgetSettings.getWidget(widgetId) || NovaWidgetSettings.DEFAULTS[widgetId]
    const alertTypeRef = { current: 'follow' }

    const formEl = document.getElementById('widget-form')
    formEl.innerHTML = renderForm(widgetId, cfg)

    if (widgetId === 'alert') {
      const tabs = document.getElementById('alert-type-tabs')
      tabs.innerHTML = ALERT_TYPES.map((t, i) =>
        `<button type="button" class="cfg-tab${i === 0 ? ' active' : ''}" data-alert-type="${t.id}">${t.icon} ${t.label}</button>`
      ).join('')
      tabs.style.display = 'flex'
    }

    updatePreview(widgetId, cfg, alertTypeRef.current)
    bindFormEvents(widgetId, cfg, alertTypeRef)

    document.getElementById('btn-test')?.addEventListener('click', () => {
      updatePreview(widgetId, readForm(widgetId), alertTypeRef.current)
    })

    const saveMsg = document.getElementById('save-msg')
    document.getElementById('btn-save')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-save')
      btn.disabled = true
      saveMsg.style.display = 'none'
      try {
        cfg = readForm(widgetId)
        NovaWidgetSettings.saveWidget(widgetId, cfg)
        const sync = await NovaWidgetSettings.syncToDesktop()
        saveMsg.className = 'save-msg success'
        saveMsg.textContent = sync.synced
          ? '✓ Paramètres enregistrés et synchronisés avec Nova Stream.'
          : '✓ Paramètres enregistrés. Liez l\'app pour appliquer sur le desktop.'
        saveMsg.style.display = 'block'
      } catch (err) {
        saveMsg.className = 'save-msg error'
        saveMsg.textContent = err.message
        saveMsg.style.display = 'block'
      } finally {
        btn.disabled = false
      }
    })
  }

  document.addEventListener('DOMContentLoaded', init)
})()
