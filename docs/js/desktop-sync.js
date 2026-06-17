;(function () {
  const DEBOUNCE_MS = 450
  const STATUS_POLL_MS = 4000

  let debounceTimer = null
  let statusTimer = null
  let desktopOnline = false
  let syncing = false
  let lastSyncAt = 0
  let lastSyncOk = false

  async function refreshDesktopStatus() {
    const status = await window.NovaLink?.checkDesktopOnline?.()
    const wasOnline = desktopOnline
    desktopOnline = !!status?.online
    if (wasOnline !== desktopOnline) {
      window.dispatchEvent(new CustomEvent('nova:desktop-status', {
        detail: { online: desktopOnline, version: status?.version }
      }))
      if (desktopOnline && window.NovaAuth?.getSession?.()) {
        scheduleAutoSync()
      }
    }
    return desktopOnline
  }

  async function pushSettings() {
    if (!window.NovaWidgetSettings?.syncToDesktop) {
      return { synced: false, reason: 'no_api' }
    }
    if (!window.NovaAuth?.getSession?.()) {
      return { synced: false, reason: 'no_session' }
    }

    const status = await window.NovaLink.checkDesktopOnline()
    if (!status?.online) {
      desktopOnline = false
      return { synced: false, reason: 'offline' }
    }

    if (syncing) return { synced: false, reason: 'busy' }
    syncing = true
    try {
      await window.NovaWidgetSettings.syncToDesktop()
      if (window.NovaDonations?.registerOnApi) {
        try {
          await window.NovaDonations.registerOnApi()
        } catch {
          /* API dons optionnelle */
        }
      }
      lastSyncAt = Date.now()
      lastSyncOk = true
      window.dispatchEvent(new CustomEvent('nova:desktop-sync', {
        detail: { synced: true, at: lastSyncAt }
      }))
      return { synced: true, at: lastSyncAt }
    } catch (err) {
      lastSyncOk = false
      const message = err instanceof Error ? err.message : 'Synchronisation échouée'
      window.dispatchEvent(new CustomEvent('nova:desktop-sync', {
        detail: { synced: false, error: message }
      }))
      return { synced: false, error: message }
    } finally {
      syncing = false
    }
  }

  function scheduleAutoSync() {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void pushSettings()
    }, DEBOUNCE_MS)
  }

  function startStatusPolling(intervalMs = STATUS_POLL_MS) {
    if (statusTimer) return
    void refreshDesktopStatus()
    statusTimer = setInterval(() => {
      void refreshDesktopStatus()
    }, intervalMs)
  }

  function formatSyncTime(ts) {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  function mountSidebarStatus() {
    const footer = document.querySelector('.dash-sidebar-footer')
    if (!footer || document.getElementById('dash-sync-status')) return

    const el = document.createElement('div')
    el.id = 'dash-sync-status'
    el.className = 'dash-sync-status'
    el.innerHTML = `
      <span class="dash-sync-dot offline" id="dash-sync-dot"></span>
      <div class="dash-sync-text">
        <strong id="dash-sync-label">App non détectée</strong>
        <span id="dash-sync-hint">Lancez Nova Stream sur ce PC</span>
      </div>
    `
    footer.prepend(el)

    function updateUi() {
      const dot = document.getElementById('dash-sync-dot')
      const label = document.getElementById('dash-sync-label')
      const hint = document.getElementById('dash-sync-hint')
      if (!dot || !label || !hint) return

      if (!desktopOnline) {
        dot.className = 'dash-sync-dot offline'
        label.textContent = 'App non détectée'
        hint.textContent = 'Lancez Nova Stream sur ce PC'
        return
      }
      if (syncing) {
        dot.className = 'dash-sync-dot syncing'
        label.textContent = 'Synchronisation…'
        hint.textContent = 'Envoi vers Nova Stream'
        return
      }
      if (lastSyncOk && lastSyncAt) {
        dot.className = 'dash-sync-dot online'
        label.textContent = 'Lié à Nova Stream'
        hint.textContent = `Sync ${formatSyncTime(lastSyncAt)}`
        return
      }
      dot.className = 'dash-sync-dot online'
      label.textContent = 'Nova Stream détecté'
      hint.textContent = 'Modifications envoyées automatiquement'
    }

    window.addEventListener('nova:desktop-status', updateUi)
    window.addEventListener('nova:desktop-sync', updateUi)
    updateUi()
  }

  function initDashboardAutoSync() {
    startStatusPolling()
    mountSidebarStatus()
  }

  window.NovaDesktopSync = {
    pushSettings,
    scheduleAutoSync,
    refreshDesktopStatus,
    startStatusPolling,
    initDashboardAutoSync,
    isDesktopOnline: () => desktopOnline,
    getLastSyncAt: () => lastSyncAt
  }
})()
