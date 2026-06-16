;(function () {
  const DEFAULTS = {
    enabled: false,
    currency: 'EUR',
    minAmount: 1,
    suggestedAmounts: [1, 3, 5, 10, 20],
    pageTitle: '',
    pageMessage: 'Soutenez le stream et laissez un message !',
    thankYouMessage: 'Merci pour votre générosité !',
    donationKey: '',
    paypalUsername: ''
  }

  function load() {
    const all = window.NovaWidgetSettings?.loadAll?.() ?? {}
    const saved = all.donations && typeof all.donations === 'object'
      ? { ...DEFAULTS, ...all.donations }
      : structuredClone(DEFAULTS)
    if (!saved.donationKey) {
      saved.donationKey = crypto.randomUUID()
    }
    return saved
  }

  function save(partial) {
    const all = window.NovaWidgetSettings.loadAll()
    const next = { ...load(), ...partial }
    if (!next.donationKey) next.donationKey = crypto.randomUUID()
    all.donations = next
    window.NovaWidgetSettings.saveAll(all)
    return next
  }

  function getTipUrl(username) {
    const base = window.NovaAuth.asset('/tip.html')
    return `${base}?u=${encodeURIComponent(username)}`
  }

  function apiUrl() {
    return (window.NOVA_CONFIG.DONATIONS_API_URL || '').replace(/\/$/, '')
  }

  async function registerOnApi() {
    const base = apiUrl()
    if (!base) return { skipped: true, reason: 'no_api' }

    const session = window.NovaAuth.getSession()
    if (!session) throw new Error('Connectez-vous avec Twitch')

    const d = load()
    const res = await fetch(`${base}/v1/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        streamerId: session.userId,
        username: session.username,
        displayName: session.displayName,
        avatarUrl: session.avatarUrl,
        donationKey: d.donationKey,
        enabled: d.enabled,
        currency: d.currency,
        minAmount: d.minAmount,
        suggestedAmounts: d.suggestedAmounts,
        pageTitle: d.pageTitle,
        pageMessage: d.pageMessage,
        thankYouMessage: d.thankYouMessage,
        paypalUsername: d.paypalUsername
      })
    })

    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Enregistrement API échoué')
    }
    return { success: true }
  }

  async function syncAll() {
    await registerOnApi()
    const status = await window.NovaLink.checkDesktopOnline()
    if (status?.online) {
      await window.NovaLink.linkToDesktop()
    } else {
      await window.NovaWidgetSettings.syncToDesktop()
    }
  }

  async function submitTip(payload) {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')

    const res = await fetch(`${base}/v1/donate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Envoi du don échoué')
    }
    return data
  }

  async function fetchStreamer(username) {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')

    const res = await fetch(
      `${base}/v1/streamer?username=${encodeURIComponent(username)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Chaîne introuvable')
    }
    return data.streamer
  }

  window.NovaDonations = {
    DEFAULTS,
    load,
    save,
    getTipUrl,
    apiUrl,
    registerOnApi,
    syncAll,
    submitTip,
    fetchStreamer
  }
})()
