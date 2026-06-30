;(function () {
  const HELIX = 'https://api.twitch.tv/helix/channel_points/custom_rewards'

  function session() {
    return window.NovaAuth?.getSession?.() ?? null
  }

  function webHeaders() {
    const s = session()
    if (!s?.accessToken) throw new Error('Connectez-vous avec Twitch sur le site.')
    return {
      Authorization: `Bearer ${s.accessToken}`,
      'Client-Id': window.NOVA_CONFIG.TWITCH_CLIENT_ID
    }
  }

  async function listViaWeb() {
    const s = session()
    const res = await fetch(`${HELIX}?broadcaster_id=${encodeURIComponent(s.userId)}`, {
      headers: webHeaders()
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || `Erreur Twitch (${res.status})`)
    }
    return data.data ?? []
  }

  async function listViaDesktop() {
    const status = await window.NovaLink?.checkDesktopOnline?.()
    if (!status?.online) throw new Error('Nova Stream non détecté')
    const res = await fetch(`${window.NOVA_CONFIG.DESKTOP_LINK_URL}/api/twitch/custom-rewards`)
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.message || 'Erreur app desktop')
    return data.rewards ?? []
  }

  async function listRewards() {
    try {
      return await listViaWeb()
    } catch (webErr) {
      try {
        return await listViaDesktop()
      } catch {
        throw webErr
      }
    }
  }

  async function createViaWeb(payload) {
    const s = session()
    const res = await fetch(`${HELIX}?broadcaster_id=${encodeURIComponent(s.userId)}`, {
      method: 'POST',
      headers: { ...webHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: payload.title,
        cost: payload.cost,
        prompt: payload.prompt || 'Votre message TTS',
        is_user_input_required: true,
        is_enabled: true,
        background_color: '#9146FF'
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || `Création échouée (${res.status})`)
    return data.data?.[0]
  }

  async function createViaDesktop(payload) {
    const res = await fetch(`${window.NOVA_CONFIG.DESKTOP_LINK_URL}/api/twitch/custom-rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.message || 'Création échouée')
    return data.reward
  }

  async function createReward(payload) {
    const title = (payload.title || 'Lire mon message').trim().slice(0, 45)
    const cost = Math.max(1, Math.min(999999, Math.round(payload.cost || 500)))
    const prompt = (payload.prompt || 'Votre message TTS').trim().slice(0, 200)
    const body = { title, cost, prompt }
    try {
      return await createViaWeb(body)
    } catch (webErr) {
      try {
        return await createViaDesktop(body)
      } catch {
        throw webErr
      }
    }
  }

  async function updateViaWeb(rewardId, partial) {
    const s = session()
    const res = await fetch(
      `${HELIX}?broadcaster_id=${encodeURIComponent(s.userId)}&id=${encodeURIComponent(rewardId)}`,
      {
        method: 'PATCH',
        headers: { ...webHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(partial)
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || `Mise à jour échouée (${res.status})`)
    return data.data?.[0]
  }

  async function updateViaDesktop(rewardId, partial) {
    const res = await fetch(`${window.NOVA_CONFIG.DESKTOP_LINK_URL}/api/twitch/custom-rewards`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rewardId, ...partial })
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.message || 'Mise à jour échouée')
    return data.reward
  }

  async function updateReward(rewardId, partial) {
    const body = {}
    if (partial.title !== undefined) body.title = partial.title.trim().slice(0, 45)
    if (partial.cost !== undefined) body.cost = Math.max(1, Math.min(999999, Math.round(partial.cost)))
    if (partial.prompt !== undefined) body.prompt = partial.prompt.trim().slice(0, 200)
    if (partial.is_enabled !== undefined) body.is_enabled = partial.is_enabled
    try {
      return await updateViaWeb(rewardId, body)
    } catch (webErr) {
      try {
        return await updateViaDesktop(rewardId, body)
      } catch {
        throw webErr
      }
    }
  }

  function ttsCompatible(rewards) {
    return (rewards ?? []).filter((r) => r.is_user_input_required)
  }

  window.NovaTtsRewards = {
    listRewards,
    createReward,
    updateReward,
    ttsCompatible
  }
})()
