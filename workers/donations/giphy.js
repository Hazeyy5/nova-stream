/** Montant minimum (EUR ou USD) pour qu'un donateur puisse ajouter un GIF Giphy. */
export const DONATION_GIF_MIN_AMOUNT = 25

const GIPHY_HOST_SUFFIX = '.giphy.com'

export function isValidGiphyUrl(raw) {
  const url = String(raw ?? '').trim()
  if (!url || url.length > 512) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    return host === 'giphy.com' || host.endsWith(GIPHY_HOST_SUFFIX)
  } catch {
    return false
  }
}

export function resolveAlertGifUrl(amount, rawUrl) {
  if (!Number.isFinite(amount) || amount < DONATION_GIF_MIN_AMOUNT) return ''
  const url = String(rawUrl ?? '').trim()
  return isValidGiphyUrl(url) ? url : ''
}

export async function searchGiphy(env, { q, limit = 12 }) {
  const key = env.GIPHY_API_KEY?.trim()
  if (!key) {
    return { configured: false, gifs: [] }
  }

  const query = String(q ?? '').trim()
  const capped = Math.min(24, Math.max(1, Number(limit) || 12))
  const endpoint = query.length >= 2
    ? new URL('https://api.giphy.com/v1/gifs/search')
    : new URL('https://api.giphy.com/v1/gifs/trending')

  endpoint.searchParams.set('api_key', key)
  endpoint.searchParams.set('limit', String(capped))
  endpoint.searchParams.set('rating', 'pg')
  if (query.length >= 2) {
    endpoint.searchParams.set('q', query)
    endpoint.searchParams.set('lang', 'fr')
  }

  const res = await fetch(endpoint.toString(), { signal: AbortSignal.timeout(8000) })
  if (!res.ok) {
    throw new Error('Giphy indisponible')
  }

  const data = await res.json()
  const gifs = (data.data ?? []).map(mapGiphyItem).filter(Boolean)
  return { configured: true, gifs }
}

function mapGiphyItem(item) {
  if (!item?.images) return null
  const url =
    item.images.original?.url ||
    item.images.downsized_medium?.url ||
    item.images.fixed_height?.url ||
    ''
  const previewUrl =
    item.images.fixed_width?.url ||
    item.images.preview_gif?.url ||
    item.images.downsized?.url ||
    url
  const mp4Url =
    item.images.original?.mp4 ||
    item.images.looping?.mp4 ||
    item.images.preview_mp4?.mp4 ||
    ''
  if (!url) return null
  const derivedMp4 = mp4Url || (url.includes('.gif') ? url.replace(/\.gif(\?.*)?$/i, '.mp4$1') : '')
  return {
    id: item.id,
    title: item.title || '',
    url,
    previewUrl,
    mp4Url: derivedMp4
  }
}
