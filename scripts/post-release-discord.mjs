#!/usr/bin/env node
/**
 * Annonce une release app Nova Stream dans #mises-a-jour sur Discord.
 */

import { postEmbed, truncate } from './lib/discord-notify.mjs'

const REF = process.env.GITHUB_REF?.trim() || ''
const VERSION = process.env.VERSION?.trim() || REF.replace(/^refs\/tags\//, '') || 'inconnue'
const RELEASE_BODY = process.env.RELEASE_BODY?.trim() || ''
const REPO = process.env.GITHUB_REPOSITORY?.trim() || 'Hazeyy5/nova-stream'
const WEBSITE = process.env.NOVA_WEBSITE_URL?.trim() || 'https://hazeyy5.github.io/nova-stream'

function buildEmbed() {
  const releaseUrl = `https://github.com/${REPO}/releases/tag/${encodeURIComponent(VERSION)}`
  const description = RELEASE_BODY
    ? truncate(RELEASE_BODY.replace(/\r\n/g, '\n'), 3800)
    : 'Consultez les notes complètes sur GitHub pour le détail des changements.'

  return [{
    title: `🚀 Nova Stream ${VERSION} — application desktop`,
    description,
    color: 0x9146ff,
    fields: [
      { name: '📥 Télécharger', value: `[Release GitHub](${releaseUrl})`, inline: true },
      { name: '🌐 Site', value: `[Tableau de bord](${WEBSITE})`, inline: true },
      { name: '🔄 Mise à jour', value: "L'app desktop se met à jour automatiquement si elle est ouverte.", inline: false }
    ],
    footer: { text: 'Nova Stream — release application' },
    timestamp: new Date().toISOString()
  }]
}

postEmbed(buildEmbed()).catch((err) => {
  console.error('[post-release]', err.message || err)
  process.exit(1)
})
