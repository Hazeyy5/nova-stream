/**
 * API relais des dons Nova Stream (Cloudflare Worker + KV).
 * Déploiement : cd workers/donations && npx wrangler deploy
 * Puis renseignez donationsApiUrl dans shared/platform.json et npm run sync-config
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
}

function streamerKey(id) {
  return `streamer:${id}`
}

function donationsKey(id) {
  return `donations:${id}`
}

async function readJson(kv, key, fallback) {
  const raw = await kv.get(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function writeJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value))
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (path === '/v1/health') {
      return json({ ok: true, service: 'nova-donations' })
    }

    if (path === '/v1/streamer' && request.method === 'GET') {
      const streamerId = url.searchParams.get('id')
      const username = url.searchParams.get('username')?.toLowerCase()
      if (!streamerId && !username) {
        return json({ success: false, message: 'id ou username requis' }, 400)
      }

      let id = streamerId
      if (!id && username) {
        const index = await readJson(env.DONATIONS_KV, `user:${username}`, null)
        id = index?.streamerId
      }
      if (!id) {
        return json({ success: false, message: 'Chaîne introuvable' }, 404)
      }

      const settings = await readJson(env.DONATIONS_KV, streamerKey(id), null)
      if (!settings?.enabled) {
        return json({ success: false, message: 'Les dons ne sont pas activés pour cette chaîne' }, 404)
      }

      return json({
        success: true,
        streamer: {
          streamerId: id,
          username: settings.username,
          displayName: settings.displayName,
          avatarUrl: settings.avatarUrl,
          currency: settings.currency ?? 'EUR',
          minAmount: settings.minAmount ?? 1,
          suggestedAmounts: settings.suggestedAmounts ?? [1, 3, 5, 10, 20],
          pageTitle: settings.pageTitle,
          pageMessage: settings.pageMessage,
          thankYouMessage: settings.thankYouMessage,
          paypalUsername: settings.paypalUsername ?? ''
        }
      })
    }

    if (path === '/v1/register' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ success: false, message: 'JSON invalide' }, 400)
      }

      const {
        streamerId,
        username,
        displayName,
        avatarUrl,
        donationKey,
        enabled,
        currency,
        minAmount,
        suggestedAmounts,
        pageTitle,
        pageMessage,
        thankYouMessage,
        paypalUsername
      } = body ?? {}

      if (!streamerId || !username || !donationKey) {
        return json({ success: false, message: 'Champs requis manquants' }, 400)
      }

      const record = {
        streamerId: String(streamerId),
        username: String(username).toLowerCase(),
        displayName: String(displayName ?? username),
        avatarUrl: avatarUrl ?? '',
        donationKey: String(donationKey),
        enabled: enabled !== false,
        currency: currency === 'USD' ? 'USD' : 'EUR',
        minAmount: Math.max(1, Number(minAmount) || 1),
        suggestedAmounts: Array.isArray(suggestedAmounts)
          ? suggestedAmounts.map(Number).filter((n) => n > 0).slice(0, 8)
          : [1, 3, 5, 10, 20],
        pageTitle: pageTitle ?? '',
        pageMessage: pageMessage ?? '',
        thankYouMessage: thankYouMessage ?? 'Merci pour votre soutien !',
        paypalUsername: String(paypalUsername ?? '').replace(/^@/, ''),
        updatedAt: Date.now()
      }

      await writeJson(env.DONATIONS_KV, streamerKey(record.streamerId), record)
      await writeJson(env.DONATIONS_KV, `user:${record.username}`, { streamerId: record.streamerId })
      return json({ success: true })
    }

    if (path === '/v1/donate' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ success: false, message: 'JSON invalide' }, 400)
      }

      const streamerId = String(body?.streamerId ?? '')
      const donorName = String(body?.donorName ?? 'Anonyme').trim().slice(0, 40)
      const message = String(body?.message ?? '').trim().slice(0, 280)
      const amount = Number(body?.amount)
      const currency = body?.currency === 'USD' ? 'USD' : 'EUR'

      if (!streamerId || !Number.isFinite(amount)) {
        return json({ success: false, message: 'Données invalides' }, 400)
      }

      const settings = await readJson(env.DONATIONS_KV, streamerKey(streamerId), null)
      if (!settings?.enabled) {
        return json({ success: false, message: 'Dons désactivés' }, 403)
      }

      const min = settings.minAmount ?? 1
      if (amount < min) {
        return json({ success: false, message: `Montant minimum : ${min} ${currency}` }, 400)
      }

      const donation = {
        id: crypto.randomUUID(),
        streamerId,
        donorName: donorName || 'Anonyme',
        message,
        amount,
        currency,
        createdAt: Date.now()
      }

      const queue = await readJson(env.DONATIONS_KV, donationsKey(streamerId), [])
      queue.push(donation)
      while (queue.length > 80) queue.shift()
      await writeJson(env.DONATIONS_KV, donationsKey(streamerId), queue)

      const symbol = currency === 'USD' ? '$' : '€'
      let paymentUrl = ''
      const paypal = settings.paypalUsername?.trim()
      if (paypal) {
        paymentUrl = `https://paypal.me/${encodeURIComponent(paypal)}/${amount}${currency}`
      }

      return json({
        success: true,
        donationId: donation.id,
        thankYouMessage: settings.thankYouMessage ?? 'Merci pour votre soutien !',
        paymentUrl,
        paymentHint: paymentUrl
          ? `Finalisez votre don de ${amount}${symbol} via PayPal pour soutenir ${settings.displayName}.`
          : `Votre don de ${amount}${symbol} a été envoyé — l'alerte apparaîtra sur le stream de ${settings.displayName}.`
      })
    }

    if (path === '/v1/poll' && request.method === 'GET') {
      const streamerId = url.searchParams.get('streamerId')
      const key = url.searchParams.get('key')
      const since = Number(url.searchParams.get('since') ?? 0)

      if (!streamerId || !key) {
        return json({ success: false, message: 'Paramètres manquants' }, 400)
      }

      const settings = await readJson(env.DONATIONS_KV, streamerKey(streamerId), null)
      if (!settings || settings.donationKey !== key) {
        return json({ success: false, message: 'Non autorisé' }, 403)
      }

      const queue = await readJson(env.DONATIONS_KV, donationsKey(streamerId), [])
      const pending = queue.filter((d) => d.createdAt > since)
      const kept = queue.filter((d) => !pending.some((p) => p.id === d.id))
      await writeJson(env.DONATIONS_KV, donationsKey(streamerId), kept)

      return json({ success: true, donations: pending })
    }

    return json({ success: false, message: 'Route introuvable' }, 404)
  }
}
