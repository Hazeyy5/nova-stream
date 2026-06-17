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

  function donationAlertCfg() {
    const d = window.NovaDonations?.load?.() ?? {}
    return {
      alertTitle: d.alertTitle || 'Don',
      alertDefaultMessage: d.alertDefaultMessage || 'Merci pour votre soutien !',
      alertMessageTemplate: d.alertMessageTemplate || '{amount} — {message}'
    }
  }

  function donationAlertPreviewMsg(cfg) {
    const template = cfg.alertMessageTemplate || '{amount} — {message}'
    const defaultMsg = cfg.alertDefaultMessage || 'Merci pour votre soutien !'
    return template
      .replace(/\{name\}/g, 'GenerousOne')
      .replace(/\{amount\}/g, '5 €')
      .replace(/\{message\}/g, 'Super stream !')
  }

  function renderAlertPreview(cfg, typeId) {
    const t = ALERT_TYPES.find((a) => a.id === typeId) || ALERT_TYPES[0]
    const el = document.getElementById('widget-preview')
    if (!el) return
    const user = window.NovaTwitchLive?.alertUser(liveContext, t.user) ?? t.user
    const donCfg = readDonationAlertForm()
    const previewMsg = typeId === 'donation' ? donationAlertPreviewMsg(donCfg) : t.msg
    const previewTitle = typeId === 'donation' ? (donCfg.alertTitle || 'Don') : null
    el.className = `widget-preview-stage alert-preview alert-style-${cfg.style || 'classic'} alert-anim-${cfg.animation || 'pop'}`
    el.innerHTML = `
      <div class="alert-preview-inner">
        <span class="alert-preview-icon">${t.icon}</span>
        <div class="alert-preview-text">
          <strong>${esc(user)}</strong>
          ${previewTitle ? `<em class="alert-preview-type">${esc(previewTitle)}</em>` : ''}
          <span>${esc(previewMsg)}</span>
        </div>
      </div>
    `
    el.style.setProperty('--alert-color', t.color)
    void el.offsetWidth
    el.classList.add('alert-playing')
    setTimeout(() => el.classList.remove('alert-playing'), 600)
  }

  let liveContext = null

  function renderChatPreview(cfg) {
    const el = document.getElementById('widget-preview')
    if (!el) return
    const lines = window.NovaTwitchLive
      ? NovaTwitchLive.chatLines(cfg, liveContext)
      : [
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
    const target = Math.max(1, cfg.target || 100)
    const current = window.NovaTwitchLive
      ? NovaTwitchLive.goalCurrent(cfg, kind, liveContext)
      : Math.max(0, Math.min(target - 1, Math.round(target * (kind === 'followerGoal' ? 0.72 : 0.45))))
    const pct = Math.min(100, Math.round((current / target) * 100))
    const style = cfg.style || 'classic'
    const accent = kind === 'subGoal' ? 'accent-gold' : 'accent-purple'
    const label = esc(cfg.label || (kind === 'followerGoal' ? 'Objectif followers' : 'Objectif abonnés'))

    el.className = `widget-preview-stage w-preview-root goal-preview goal-style-${style} ${accent}`

    if (style === 'minimal') {
      const fmt = window.NovaTwitchLive?.formatCount ?? ((n) => String(n))
      el.innerHTML = `<p class="w-preview-minimal-text">${label}: ${fmt(current)} / ${fmt(target)}</p>`
      return
    }

    el.innerHTML = `
      <div class="w-preview-box">
        <span class="w-preview-label">${label.toUpperCase()}</span>
        <div class="w-preview-bar-track">
          <div class="w-preview-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="w-preview-stat">${window.NovaTwitchLive ? NovaTwitchLive.formatCount(current) : current} / ${window.NovaTwitchLive ? NovaTwitchLive.formatCount(target) : target}</span>
      </div>
    `
  }

  function renderViewerPreview(cfg) {
    const el = document.getElementById('widget-preview')
    if (!el) return
    const style = cfg.style || 'neon'
    const label = esc(cfg.label || 'Spectateurs')
    const count = window.NovaTwitchLive
      ? NovaTwitchLive.viewerCountValue(cfg, liveContext)
      : '1 284'
    const isLive = liveContext?.stats?.live

    el.className = `widget-preview-stage w-preview-root viewer-preview viewer-style-${style}`

    if (style === 'minimal') {
      el.innerHTML = `
        <div class="w-preview-minimal-viewer">
          <span class="w-preview-label-min">${label.toUpperCase()}</span>
          <span class="w-preview-count-min">${count}</span>
        </div>
      `
      return
    }

    el.innerHTML = `
      <div class="w-preview-box viewer-box">
        <span class="w-preview-label">👁 ${label.toUpperCase()}</span>
        <span class="w-preview-count">${count}</span>
        ${style === 'neon' && isLive ? '<span class="w-preview-live">● LIVE</span>' : ''}
      </div>
    `
  }

  function renderPollPreview(cfg) {
    const el = document.getElementById('widget-preview')
    if (!el) return
    const style = cfg.style || 'bars'
    const question = esc(cfg.question || 'Votre question ici')
    const opts = (cfg.options || []).filter(Boolean)
    const displayOpts = opts.length ? opts : ['Option A', 'Option B', 'Option C']
    const votes = displayOpts.map((_, i) => [40, 28, 18, 14][i] ?? 10)
    const total = votes.reduce((a, b) => a + b, 0) || 1

    el.className = `widget-preview-stage w-preview-root poll-preview poll-style-${style}`
    el.innerHTML = `
      <div class="w-preview-box poll-box">
        <span class="w-preview-tag">📊 SONDAGE</span>
        <span class="w-preview-question">${question}</span>
        <div class="w-preview-poll-rows">
          ${displayOpts.map((opt, i) => {
            const pct = Math.round((votes[i] / total) * 100)
            return `
              <div class="w-preview-poll-row">
                <div class="w-preview-poll-row-head">
                  <span>${esc(opt)}</span>
                  <span class="w-preview-poll-pct">${pct}%</span>
                </div>
                ${style === 'bars' ? `
                  <div class="w-preview-bar-track w-preview-poll-track">
                    <div class="w-preview-bar-fill w-preview-poll-fill" style="width:${pct}%"></div>
                  </div>
                ` : ''}
              </div>
            `
          }).join('')}
        </div>
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

  function renderDonationAlertFields() {
    const d = donationAlertCfg()
    return `
      <div class="cfg-subsection" id="donation-alert-fields">
        <p class="cfg-subtitle">Texte alerte don</p>
        <p class="cfg-hint">Variables : {name}, {amount}, {message}</p>
        ${fieldText('cfg-don-title', 'Libellé', d.alertTitle, 'Don')}
        ${fieldText('cfg-don-default', 'Message par défaut', d.alertDefaultMessage, 'Merci pour votre soutien !')}
        ${fieldText('cfg-don-template', 'Modèle affiché', d.alertMessageTemplate, '{amount} — {message}')}
      </div>
    `
  }

  function readDonationAlertForm() {
    const g = (id) => document.getElementById(id)
    return {
      alertTitle: g('cfg-don-title')?.value?.trim() || 'Don',
      alertDefaultMessage: g('cfg-don-default')?.value?.trim() || 'Merci pour votre soutien !',
      alertMessageTemplate: g('cfg-don-template')?.value?.trim() || '{amount} — {message}'
    }
  }

  function saveDonationAlertFields() {
    if (!window.NovaDonations?.save) return
    window.NovaDonations.save(readDonationAlertForm())
  }

  function setDonationAlertFieldsVisible(show) {
    const el = document.getElementById('donation-alert-fields')
    if (el) el.style.display = show ? 'block' : 'none'
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
          ${renderDonationAlertFields()}
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
        NovaWidgetSettings.saveWidget(widgetId, next)
        if (widgetId === 'alert') saveDonationAlertFields()
        updatePreview(widgetId, next, alertTypeRef.current)
        refreshModuleUrls(widgetId, next)
        if (window.NovaDesktopSync) window.NovaDesktopSync.scheduleAutoSync()
        if (el.type === 'range') {
          const out = el.parentElement?.querySelector('output')
          if (out) out.textContent = el.value + (el.id === 'cfg-duration' ? 's' : '')
        }
      })
      el.addEventListener('change', () => {
        const next = readForm(widgetId)
        NovaWidgetSettings.saveWidget(widgetId, next)
        if (widgetId === 'alert') saveDonationAlertFields()
        updatePreview(widgetId, next, alertTypeRef.current)
        refreshModuleUrls(widgetId, next)
        if (window.NovaDesktopSync) window.NovaDesktopSync.scheduleAutoSync()
      })
    })

    if (widgetId === 'alert') {
      document.querySelectorAll('[data-alert-type]').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-alert-type]').forEach((b) => b.classList.remove('active'))
          btn.classList.add('active')
          alertTypeRef.current = btn.dataset.alertType
          setDonationAlertFieldsVisible(alertTypeRef.current === 'donation')
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
      setDonationAlertFieldsVisible(false)
    }

    updatePreview(widgetId, cfg, alertTypeRef.current)
    bindFormEvents(widgetId, cfg, alertTypeRef)
    bindModuleUrlUi(widgetId, alertTypeRef)

    if (window.NovaTwitchLive) {
      NovaTwitchLive.subscribe((ctx) => {
        liveContext = ctx
        updatePreview(widgetId, readForm(widgetId), alertTypeRef.current)
      })
      NovaTwitchLive.startPolling(15000)
    }

    const saveMsg = document.getElementById('save-msg')
    document.getElementById('btn-save')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-save')
      btn.disabled = true
      saveMsg.style.display = 'none'
      try {
        cfg = readForm(widgetId)
        if (widgetId === 'alert') saveDonationAlertFields()
        NovaWidgetSettings.saveWidget(widgetId, cfg)
        refreshModuleUrls(widgetId, cfg)
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

  function refreshModuleUrls(widgetId, cfg) {
    const urls = NovaWidgetSettings.getModuleUrls(widgetId, cfg)
    const localEl = document.getElementById('url-local')
    const webEl = document.getElementById('url-web')
    if (localEl) localEl.value = urls.local
    if (webEl) webEl.value = urls.web
  }

  async function copyText(text) {
    await navigator.clipboard.writeText(text)
  }

  function showTestMsg(text, ok) {
    const el = document.getElementById('test-msg')
    if (!el) return
    el.className = ok ? 'test-msg success' : 'test-msg error'
    el.textContent = text
    el.style.display = 'block'
  }

  function bindModuleUrlUi(widgetId, alertTypeRef) {
    refreshModuleUrls(widgetId, NovaWidgetSettings.getWidget(widgetId) || {})

    document.getElementById('btn-copy-local')?.addEventListener('click', () => {
      void copyText(document.getElementById('url-local')?.value ?? '').then(() =>
        showTestMsg('URL locale copiée.', true)
      )
    })
    document.getElementById('btn-copy-web')?.addEventListener('click', () => {
      void copyText(document.getElementById('url-web')?.value ?? '').then(() =>
        showTestMsg('URL web copiée.', true)
      )
    })
    document.getElementById('btn-open-local')?.addEventListener('click', () => {
      const url = document.getElementById('url-local')?.value
      if (url) window.open(url, '_blank', 'noopener')
    })
    document.getElementById('btn-open-web')?.addEventListener('click', () => {
      const url = document.getElementById('url-web')?.value
      if (url) window.open(url, '_blank', 'noopener')
    })
    document.getElementById('btn-preview')?.addEventListener('click', () => {
      updatePreview(widgetId, readForm(widgetId), alertTypeRef.current)
    })
    document.getElementById('btn-test-app')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-test-app')
      const cfg = readForm(widgetId)
      NovaWidgetSettings.saveWidget(widgetId, cfg)
      btn.disabled = true
      try {
        await NovaLink.syncWidgetSettings()
        if (widgetId === 'alert') await NovaDonations.registerOnApi().catch(() => {})
        const payload = { widget: widgetId, settings: cfg }
        if (widgetId === 'alert') {
          payload.alertType = alertTypeRef.current
        }
        await NovaLink.testWidget(payload)
        showTestMsg('✓ Test envoyé — regardez Nova Stream sur votre scène active.', true)
      } catch (err) {
        showTestMsg(err instanceof Error ? err.message : 'Test échoué', false)
      } finally {
        btn.disabled = false
      }
    })
  }

  document.addEventListener('DOMContentLoaded', init)
})()
