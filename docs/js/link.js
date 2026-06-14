async function checkDesktopOnline() {
  const url = `${window.NOVA_CONFIG.DESKTOP_LINK_URL}/api/status`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function linkToDesktop() {
  const session = window.NovaAuth.getSession()
  if (!session) throw new Error('Non connecté')

  const status = await checkDesktopOnline()
  if (!status?.online) {
    throw new Error('Nova Stream n\'est pas lancé sur votre PC. Ouvrez l\'application puis réessayez.')
  }

  const res = await fetch(`${window.NOVA_CONFIG.DESKTOP_LINK_URL}/api/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: 'twitch',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      userId: session.userId,
      username: session.username,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
      widgetSettings: window.NovaWidgetSettings?.loadAll?.() ?? undefined,
      widgetToken: window.NovaWidgetSettings?.getWidgetToken?.() ?? undefined
    })
  })

  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.message ?? 'Échec de la liaison')
  }
  return data
}

async function testWidget(payload) {
  const status = await checkDesktopOnline()
  if (!status?.online) {
    throw new Error('Nova Stream n\'est pas lancé. Ouvrez l\'application puis réessayez.')
  }

  const res = await fetch(`${window.NOVA_CONFIG.DESKTOP_LINK_URL}/api/test-widget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.message ?? 'Test échoué')
  }
  return data
}

async function syncWidgetSettings() {
  const status = await checkDesktopOnline()
  if (!status?.online) {
    throw new Error('Nova Stream non détecté')
  }
  return NovaWidgetSettings.syncToDesktop()
}

async function getWidgetStats() {
  const url = `${window.NOVA_CONFIG.DESKTOP_LINK_URL}/api/widget-stats`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

window.NovaLink = { checkDesktopOnline, linkToDesktop, testWidget, syncWidgetSettings, getWidgetStats }
