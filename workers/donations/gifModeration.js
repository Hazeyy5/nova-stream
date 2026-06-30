import { extractGiphyId, isValidGiphyUrl } from './giphy.js'

export async function isGifBlocked(db, streamerId, rawUrl) {
  const url = String(rawUrl ?? '').trim()
  if (!url || !isValidGiphyUrl(url)) return false

  const gifId = extractGiphyId(url)
  const row = await db
    .prepare(`
      SELECT id FROM gif_blocklist
      WHERE streamer_id = ?
        AND (gif_url = ? OR (gif_id != '' AND gif_id = ?))
      LIMIT 1
    `)
    .bind(streamerId, url, gifId || '__none__')
    .first()

  return !!row
}

export async function filterBlockedGif(db, streamerId, rawUrl) {
  if (!rawUrl) return ''
  if (await isGifBlocked(db, streamerId, rawUrl)) return ''
  return rawUrl
}

export async function listBlockedGifs(db, streamerId) {
  const { results } = await db
    .prepare(`
      SELECT id, gif_url, gif_id, reason, created_at
      FROM gif_blocklist
      WHERE streamer_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `)
    .bind(streamerId)
    .all()

  return (results ?? []).map((row) => ({
    id: row.id,
    gifUrl: row.gif_url,
    gifId: row.gif_id || '',
    reason: row.reason || '',
    createdAt: row.created_at
  }))
}

export async function addBlockedGif(db, streamerId, rawUrl, reason = '') {
  const url = String(rawUrl ?? '').trim()
  if (!isValidGiphyUrl(url)) {
    throw new Error('URL Giphy invalide')
  }

  const id = crypto.randomUUID()
  const gifId = extractGiphyId(url) || ''
  const now = Date.now()

  await db
    .prepare(`
      INSERT INTO gif_blocklist (id, streamer_id, gif_url, gif_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(streamer_id, gif_url) DO UPDATE SET
        reason = excluded.reason,
        gif_id = excluded.gif_id
    `)
    .bind(id, streamerId, url, gifId, String(reason).slice(0, 200), now)
    .run()

  return { id, gifUrl: url, gifId, reason, createdAt: now }
}

export async function removeBlockedGif(db, streamerId, entryId) {
  const result = await db
    .prepare('DELETE FROM gif_blocklist WHERE id = ? AND streamer_id = ?')
    .bind(entryId, streamerId)
    .run()
  return (result.meta?.changes ?? 0) > 0
}
