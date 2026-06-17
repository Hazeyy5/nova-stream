;(function () {
  const NAV = [
    { section: null, items: [
      { id: 'dashboard', label: 'Tableau de bord', href: '/dashboard.html', icon: '▣' }
    ]},
    { section: "L'essentiel du streaming", items: [
      { id: 'alert', label: "Fenêtre d'alerte", href: '/widget-config.html?w=alert', icon: '🔔' },
      { id: 'chat', label: 'Fenêtre de chat', href: '/widget-config.html?w=chat', icon: '💬' },
      { id: 'donations', label: 'Dons', href: '/donations.html', icon: '💰' }
    ]},
    { section: 'Widgets canvas', items: [
      { id: 'followerGoal', label: 'Objectif followers', href: '/widget-config.html?w=followerGoal', icon: '🎯' },
      { id: 'subGoal', label: 'Objectif abonnés', href: '/widget-config.html?w=subGoal', icon: '⭐' },
      { id: 'viewerCount', label: 'Spectateurs', href: '/widget-config.html?w=viewerCount', icon: '👁' },
      { id: 'poll', label: 'Sondage', href: '/widget-config.html?w=poll', icon: '📊' }
    ]}
  ]

  function requireAuth() {
    if (!window.NovaAuth?.getSession()) {
      location.href = NovaAuth.asset('/index.html')
      return null
    }
    return NovaAuth.getSession()
  }

  function renderSidebar(activeId) {
    const session = NovaAuth.getSession()
    return `
      <div class="dash-sidebar-inner">
        <a href="${NovaAuth.asset('/dashboard.html')}" class="dash-sidebar-logo">
          <img src="${NovaAuth.asset('/assets/logo.png')}" alt="" width="32" height="32" />
          <span>Nova Stream</span>
        </a>
        <div class="dash-sidebar-profile">
          <img src="${session.avatarUrl}" alt="" class="dash-sidebar-avatar" />
          <div>
            <strong>${session.displayName}</strong>
            <span>@${session.username}</span>
          </div>
        </div>
        <nav class="dash-nav">
          ${NAV.map((group) => `
            ${group.section ? `<p class="dash-nav-section">${group.section}</p>` : ''}
            <ul>
              ${group.items.map((item) => `
                <li>
                  <a href="${NovaAuth.asset(item.href)}"
                     class="dash-nav-link${activeId === item.id ? ' active' : ''}">
                    <span class="dash-nav-icon">${item.icon}</span>
                    ${item.label}
                  </a>
                </li>
              `).join('')}
            </ul>
          `).join('')}
        </nav>
        <div class="dash-sidebar-footer">
          <a href="${NovaAuth.asset('/dashboard.html')}#link" class="dash-nav-link">
            <span class="dash-nav-icon">🔗</span>
            Lier à l'app
          </a>
          <button type="button" class="dash-nav-link dash-nav-btn" id="dash-logout">
            <span class="dash-nav-icon">↩</span>
            Déconnexion
          </button>
        </div>
      </div>
    `
  }

  function mountLayout(options) {
    const session = requireAuth()
    if (!session) return null

    document.body.classList.add('dash-app')
    const sidebar = document.createElement('aside')
    sidebar.className = 'dash-sidebar'
    sidebar.innerHTML = renderSidebar(options.activeId)
    document.body.prepend(sidebar)

    const main = document.querySelector('[data-dash-main]')
    if (main) main.classList.add('dash-main')

    document.getElementById('dash-logout')?.addEventListener('click', () => NovaAuth.logout())

    if (window.NovaDesktopSync?.initDashboardAutoSync) {
      window.NovaDesktopSync.initDashboardAutoSync()
    }

    return session
  }

  window.NovaDash = { mountLayout, requireAuth, NAV }
})()
