#!/usr/bin/env node
/**
 * Annonce une release Nova Stream dans #mises-a-jour sur Discord.
 *
 * Variables d'environnement :
 *   DISCORD_BOT_TOKEN — token du bot Nova Stream
 *   DISCORD_GUILD_ID — ID du serveur Discord
 *   DISCORD_UPDATES_CHANNEL — nom du salon (défaut: mises-a-jour) ou ID numérique
 *   GITHUB_REF — ex. refs/tags/v0.9.0 (ou VERSION)
 *   RELEASE_BODY — notes de release (markdown GitHub)
 *   GITHUB_REPOSITORY — owner/repo (optionnel, pour lien release)
 */

const TOKEN = process.env.DISCORD_BOT_TOKEN?.trim()
const GUILD_ID = process.env.DISCORD_GUILD_ID?.trim()
const CHANNEL = process.env.DISCORD_UPDATES_CHANNEL?.trim() || 'mises-a-jour'
const REF = process.env.GITHUB_REF?.trim() || ''
const VERSION = process.env.VERSION?.trim() || REF.replace(/^refs\/tags\//, '') || 'inconnue'
const RELEASE_BODY = process.env.RELEASE_BODY?.trim() || ''
const REPO = process.env.GITHUB_REPOSITORY?.trim() || 'Hazeyy5/nova-stream'
const WEBSITE = process.env.NOVA_WEBSITE_URL?.trim() || 'https://hazeyy5.github.io/nova-stream'

function truncate(str, max) {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '…'
}

async function discordFetch(path, options = {}) {
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

async function resolveChannelId() {
  if (/^\d{17,20}$/.test(CHANNEL)) return CHANNEL
  const channels = await discordFetch(`/guilds/${GUILD_ID}/channels`)
  const ch = channels.find((c) => c.type === 0 && c.name === CHANNEL)
  if (!ch) throw new Error(`Salon #${CHANNEL} introuvable sur le serveur ${GUILD_ID}`)
  return ch.id
}

function buildEmbed() {
  const releaseUrl = `https://github.com/${REPO}/releases/tag/${encodeURIComponent(VERSION)}`
  const description = RELEASE_BODY
    ? truncate(RELEASE_BODY.replace(/\r\n/g, '\n'), 3800)
    : 'Consultez les notes complètes sur GitHub pour le détail des changements.'

  return {
    embeds: [{
      title: `🚀 Nova Stream ${VERSION}`,
      description,
      color: 0x9146ff,
      fields: [
        { name: '📥 Télécharger', value: `[Release GitHub](${releaseUrl})`, inline: true },
        { name: '🌐 Site', value: `[Tableau de bord](${WEBSITE})`, inline: true },
        { name: '🔄 Mise à jour', value: "L'app desktop se met à jour automatiquement si elle est ouverte.", inline: false }
      ],
      footer: { text: 'Nova Stream — mises à jour automatiques' },
      timestamp: new Date().toISOString()
    }]
  }
}

async function main() {
  if (!TOKEN) {
    console.error('[post-release] DISCORD_BOT_TOKEN manquant — annonce Discord ignorée.')
    process.exit(0)
  }
  if (!GUILD_ID) {
    console.error('[post-release] DISCORD_GUILD_ID manquant — annonce Discord ignorée.')
    process.exit(0)
  }

  const channelId = await resolveChannelId()
  const payload = buildEmbed()
  await discordFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  console.info(`[post-release] Annonce ${VERSION} publiée dans #${CHANNEL} (${channelId})`)
}

main().catch((err) => {
  console.error('[post-release]', err.message || err)
  process.exit(1)
})
