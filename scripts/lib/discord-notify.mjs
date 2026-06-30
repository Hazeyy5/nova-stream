/** Utilitaires partagés pour les annonces Discord #mises-a-jour. */

export const TOKEN = process.env.DISCORD_BOT_TOKEN?.trim()
export const GUILD_ID = process.env.DISCORD_GUILD_ID?.trim()
export const CHANNEL = process.env.DISCORD_UPDATES_CHANNEL?.trim() || 'mises-a-jour'

export function truncate(str, max) {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '…'
}

export async function discordFetch(path, options = {}) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Discord API ${path} (${res.status}): ${text.slice(0, 300)}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export async function resolveChannelId() {
  if (/^\d{17,20}$/.test(CHANNEL)) return CHANNEL
  const channels = await discordFetch(`/guilds/${GUILD_ID}/channels`)
  const ch = channels.find((c) => c.type === 0 && c.name === CHANNEL)
  if (!ch) throw new Error(`Salon #${CHANNEL} introuvable sur le serveur ${GUILD_ID}`)
  return ch.id
}

export async function postEmbed(embeds, options = {}) {
  if (!TOKEN) {
    console.error('[discord-notify] DISCORD_BOT_TOKEN manquant — annonce ignorée.')
    process.exit(0)
  }
  if (!GUILD_ID) {
    console.error('[discord-notify] DISCORD_GUILD_ID manquant — annonce ignorée.')
    process.exit(0)
  }
  const channelId = await resolveChannelId()
  const body = { embeds }
  if (options.content) body.content = options.content
  await discordFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(body)
  })
  console.info(`[discord-notify] Message publié dans #${CHANNEL} (${channelId})`)
}
