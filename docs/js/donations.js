;(function () {
  const DEFAULTS = {
    enabled: false,
    currency: 'EUR',
    minAmount: 1,
    suggestedAmounts: [1, 3, 5, 10, 20],
    pageTitle: '',
    pageMessage: 'Soutenez le stream et laissez un message !',
    thankYouMessage: 'Merci pour votre générosité !',
    alertTitle: 'Don',
    alertDefaultMessage: 'Merci pour votre soutien !',
    alertMessageTemplate: '{amount} — {message}',
    donationKey: '',
    paypalUsername: '',
    paypalAccountType: 'standard',
    donationGifMinAmount: 25,
    donationGifEnabled: true
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
        alertTitle: d.alertTitle,
        alertDefaultMessage: d.alertDefaultMessage,
        alertMessageTemplate: d.alertMessageTemplate,
        paypalUsername: d.paypalUsername,
        donationGifMinAmount: d.donationGifMinAmount ?? 25,
        donationGifEnabled: d.donationGifEnabled !== false
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

  async function fetchPayPalConfig() {
    const base = apiUrl()
    if (!base) return { configured: false, clientId: '' }
    const res = await fetch(`${base}/v1/paypal/config`, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    return data
  }

  async function fetchPayPalStatus() {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')
    const session = window.NovaAuth.getSession()
    if (!session) throw new Error('Connectez-vous avec Twitch')
    const d = load()
    const url = new URL(`${base}/v1/paypal/status`)
    url.searchParams.set('streamerId', session.userId)
    url.searchParams.set('key', d.donationKey)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Statut PayPal indisponible')
    }
    return data.paypal
  }

  async function getPayPalConnectUrl(accountType, returnUrl) {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')
    const session = window.NovaAuth.getSession()
    if (!session) throw new Error('Connectez-vous avec Twitch')
    const d = load()
    const url = new URL(`${base}/v1/paypal/connect-url`)
    url.searchParams.set('streamerId', session.userId)
    url.searchParams.set('key', d.donationKey)
    url.searchParams.set('accountType', accountType === 'business' ? 'business' : 'standard')
    if (returnUrl) url.searchParams.set('returnUrl', returnUrl)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Connexion PayPal indisponible')
    }
    return data.url
  }

  async function disconnectPayPal() {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')
    const session = window.NovaAuth.getSession()
    if (!session) throw new Error('Connectez-vous avec Twitch')
    const d = load()
    const res = await fetch(`${base}/v1/paypal/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamerId: session.userId, key: d.donationKey })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Déconnexion PayPal échouée')
    }
    return data
  }

  async function createPayPalOrder(payload) {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')
    const res = await fetch(`${base}/v1/paypal/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Création commande PayPal échouée')
    }
    return data
  }

  async function capturePayPalOrder(payload) {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')
    const res = await fetch(`${base}/v1/paypal/capture-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Capture PayPal échouée')
    }
    return data
  }

  /** Legacy — alerte immédiate sans vérification paiement. */
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

  async function fetchHistory(limit = 30) {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')

    const session = window.NovaAuth.getSession()
    if (!session) throw new Error('Connectez-vous avec Twitch')

    const d = load()
    const url = new URL(`${base}/v1/history`)
    url.searchParams.set('streamerId', session.userId)
    url.searchParams.set('key', d.donationKey)
    url.searchParams.set('limit', String(limit))

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Impossible de charger l\'historique')
    }
    return data
  }

  function authQueryParams() {
    const session = window.NovaAuth.getSession()
    if (!session) throw new Error('Connectez-vous avec Twitch')
    const d = load()
    return { streamerId: session.userId, key: d.donationKey }
  }

  async function fetchStats() {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')
    const { streamerId, key } = authQueryParams()
    const url = new URL(`${base}/v1/stats`)
    url.searchParams.set('streamerId', streamerId)
    url.searchParams.set('key', key)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Statistiques indisponibles')
    }
    return data.stats
  }

  async function fetchGifBlocklist() {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')
    const { streamerId, key } = authQueryParams()
    const url = new URL(`${base}/v1/gif-blocklist`)
    url.searchParams.set('streamerId', streamerId)
    url.searchParams.set('key', key)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Liste de blocage indisponible')
    }
    return data.blocked || []
  }

  async function blockGif(gifUrl, reason = 'Bloqué par le streamer') {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')
    const { streamerId, key } = authQueryParams()
    const res = await fetch(`${base}/v1/gif-blocklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamerId, key, gifUrl, reason })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Blocage échoué')
    }
    return data.entry
  }

  async function unblockGif(entryId) {
    const base = apiUrl()
    if (!base) throw new Error('Service de dons non configuré')
    const { streamerId, key } = authQueryParams()
    const url = new URL(`${base}/v1/gif-blocklist`)
    url.searchParams.set('streamerId', streamerId)
    url.searchParams.set('key', key)
    url.searchParams.set('id', entryId)
    const res = await fetch(url.toString(), { method: 'DELETE', signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message ?? 'Déblocage échoué')
    }
    return true
  }

  window.NovaDonations = {
    DEFAULTS,
    load,
    save,
    getTipUrl,
    apiUrl,
    registerOnApi,
    syncAll,
    fetchPayPalConfig,
    fetchPayPalStatus,
    getPayPalConnectUrl,
    disconnectPayPal,
    createPayPalOrder,
    capturePayPalOrder,
    submitTip,
    fetchStreamer,
    fetchHistory,
    fetchStats,
    fetchGifBlocklist,
    blockGif,
    unblockGif
  }
})()
