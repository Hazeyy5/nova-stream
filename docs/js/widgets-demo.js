;(function () {
  const ALERTS = [
    { type: 'follow', icon: '💜', user: 'NovaFan42', msg: 'Nouveau follower', color: '#9146FF' },
    { type: 'sub', icon: '⭐', user: 'SubLover', msg: 'Merci pour le sub !', color: '#f1c40f' },
    { type: 'donation', icon: '💰', user: 'GenerousOne', msg: '5 € — Super stream !', color: '#2ecc71' },
    { type: 'raid', icon: '🚀', user: 'RaidSquad', msg: 'Raid avec 128 viewers', color: '#e74c3c' }
  ]

  const ALERT_STYLES = ['classic', 'minimal', 'neon', 'banner', 'celebration', 'sleek']
  const CHAT_STYLES = ['classic', 'minimal', 'neon', 'bubble', 'retro']

  const CHAT_LINES = [
    { user: 'ViewerOne', color: '#a78bfa', text: 'Salut le stream !' },
    { user: 'ModTeam', color: '#f472b6', text: 'Bienvenue sur Nova Stream 🎉' },
    { user: 'SubFan', color: '#34d399', text: 'GG pour le raid !' }
  ]

  let alertIndex = 0
  let alertStyle = 'classic'
  let chatStyle = 'classic'

  function $(id) {
    return document.getElementById(id)
  }

  function renderAlertPreview(container) {
    if (!container) return
    const a = ALERTS[alertIndex]
    container.className = `alert-preview alert-style-${alertStyle} alert-anim-pop`
    container.innerHTML = `
      <div class="alert-preview-inner">
        <span class="alert-preview-icon">${a.icon}</span>
        <div class="alert-preview-text">
          <strong>${a.user}</strong>
          <span>${a.msg}</span>
        </div>
      </div>
    `
    container.style.setProperty('--alert-color', a.color)
    void container.offsetWidth
    container.classList.add('alert-playing')
    setTimeout(() => container.classList.remove('alert-playing'), 600)
  }

  function renderChatPreview(container) {
    if (!container) return
    container.className = `chat-preview chat-style-${chatStyle}`
    container.innerHTML = CHAT_LINES.map(
      (l) => `<div class="chat-line"><span class="chat-user" style="color:${l.color}">${l.user}</span><span class="chat-text">${l.text}</span></div>`
    ).join('')
  }

  function bindStyleTabs(groupSelector, styles, onSelect) {
    document.querySelectorAll(groupSelector).forEach((group) => {
      group.querySelectorAll('[data-style]').forEach((btn) => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('[data-style]').forEach((b) => b.classList.remove('active'))
          btn.classList.add('active')
          onSelect(btn.dataset.style)
        })
      })
    })
  }

  function initAlertDemo() {
    const preview = $('alert-preview')
    const typeBtns = document.querySelectorAll('[data-alert-type]')
    typeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        alertIndex = parseInt(btn.dataset.alertType, 10)
        typeBtns.forEach((b) => b.classList.remove('active'))
        btn.classList.add('active')
        renderAlertPreview(preview)
      })
    })
    bindStyleTabs('.alert-style-tabs', ALERT_STYLES, (s) => {
      alertStyle = s
      renderAlertPreview(preview)
    })
    renderAlertPreview(preview)
    setInterval(() => {
      if (!document.hidden && preview) {
        alertIndex = (alertIndex + 1) % ALERTS.length
        typeBtns.forEach((b, i) => b.classList.toggle('active', i === alertIndex))
        renderAlertPreview(preview)
      }
    }, 5000)
  }

  function initChatDemo() {
    const preview = $('chat-preview')
    bindStyleTabs('.chat-style-tabs', CHAT_STYLES, (s) => {
      chatStyle = s
      renderChatPreview(preview)
    })
    renderChatPreview(preview)
  }

  function initDashboardStatus() {
    const list = $('integration-list')
    if (!list) return
    const items = [
      { icon: '💬', label: 'Chat Twitch', desc: 'Lecture et envoi des messages' },
      { icon: '🔔', label: 'Alertes EventSub', desc: 'Follows, subs, raids en temps réel' },
      { icon: '🎨', label: 'Widgets canvas', desc: 'Objectifs, viewers, sondages' },
      { icon: '📡', label: 'Clé de stream', desc: 'Récupération automatique via Helix' },
      { icon: '📺', label: 'Go Live', desc: 'Titre et catégorie avant le live' }
    ]
    list.innerHTML = items
      .map(
        (i) => `<li class="integration-item"><span class="integration-icon">${i.icon}</span><div><strong>${i.label}</strong><span>${i.desc}</span></div></li>`
      )
      .join('')
  }

  document.addEventListener('DOMContentLoaded', () => {
    initAlertDemo()
    initChatDemo()
    initDashboardStatus()
  })

  window.NovaWidgetsDemo = { renderAlertPreview, renderChatPreview }
})()
