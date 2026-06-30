#!/usr/bin/env node
/**
 * Annonce un déploiement du site web Nova Stream dans #mises-a-jour.
 *
 * Variables :
 *   DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_UPDATES_CHANNEL
 *   GITHUB_REPOSITORY, GITHUB_SHA
 *   COMMIT_MESSAGE — titre du commit (ou plusieurs lignes)
 *   CHANGED_FILES — sortie git diff --name-status (une entrée par ligne)
 *   NOVA_WEBSITE_URL
 */

import { postEmbed, truncate } from './lib/discord-notify.mjs'

const REPO = process.env.GITHUB_REPOSITORY?.trim() || 'Hazeyy5/nova-stream'
const SHA = process.env.GITHUB_SHA?.trim() || ''
const SHORT_SHA = SHA.slice(0, 7)
const COMMIT_MESSAGE = process.env.COMMIT_MESSAGE?.trim() || 'Mise à jour du site'
const CHANGED_RAW = process.env.CHANGED_FILES?.trim() || ''
const WEBSITE = process.env.NOVA_WEBSITE_URL?.trim() || 'https://hazeyy5.github.io/nova-stream'

const STATUS_LABEL = {
  A: '➕',
  M: '✏️',
  D: '🗑️',
  R: '🔄',
  C: '📋'
}

function fileLabel(path) {
  const name = path.replace(/^docs\//, '').replace(/^shared\//, 'config/')
  if (name.endsWith('.html')) return `Page \`${name}\``
  if (name.startsWith('js/')) return `Script \`${name}\``
  if (name.startsWith('css/')) return `Style \`${name}\``
  if (name === 'config/platform.json' || name === 'platform.json') return 'Configuration plateforme'
  if (name.startsWith('overlays/')) return `Overlay \`${name}\``
  return `\`${name}\``
}

function parseChangedFiles(raw) {
  const groups = {
    pages: [],
    scripts: [],
    styles: [],
    config: [],
    overlays: [],
    other: []
  }

  for (const line of raw.split('\n').filter(Boolean)) {
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    const status = line.slice(0, tab).charAt(0)
    const path = line.slice(tab + 1).split('\t').pop()?.trim() || ''
    if (!path.startsWith('docs/') && !path.startsWith('shared/')) continue

    const icon = STATUS_LABEL[status] || '•'
    const entry = `${icon} ${fileLabel(path)}`

    if (path.endsWith('.html')) groups.pages.push(entry)
    else if (path.includes('/overlays/') || path.startsWith('docs/overlays/')) groups.overlays.push(entry)
    else if (path.endsWith('.css')) groups.styles.push(entry)
    else if (path.startsWith('docs/js/')) groups.scripts.push(entry)
    else if (path.startsWith('shared/')) groups.config.push(entry)
    else groups.other.push(entry)
  }

  return groups
}

function buildDescription(groups) {
  const sections = []
  const pushGroup = (title, items) => {
    if (items.length === 0) return
    sections.push(`**${title}**\n${items.slice(0, 12).join('\n')}${items.length > 12 ? `\n… +${items.length - 12} fichier(s)` : ''}`)
  }

  pushGroup('📄 Pages', groups.pages)
  pushGroup('⚙️ Scripts', groups.scripts)
  pushGroup('🎨 Styles', groups.styles)
  pushGroup('🔗 Overlays', groups.overlays)
  pushGroup('⚙️ Configuration', groups.config)
  pushGroup('📁 Autre', groups.other)

  if (sections.length === 0) {
    return 'Le site a été redéployé sur GitHub Pages.\nConsultez le dépôt pour le détail des changements.'
  }

  return sections.join('\n\n')
}

function buildEmbed() {
  const groups = parseChangedFiles(CHANGED_RAW)
  const commitUrl = SHA
    ? `https://github.com/${REPO}/commit/${SHA}`
    : `https://github.com/${REPO}`

  const description = truncate(
    [`**${COMMIT_MESSAGE.split('\n')[0]}**`, '', buildDescription(groups)].join('\n'),
    3900
  )

  return [{
    title: '🌐 Site web Nova Stream mis à jour',
    description,
    color: 0x5865f2,
    fields: [
      { name: '🔗 Site live', value: `[Ouvrir le site](${WEBSITE})`, inline: true },
      { name: '📦 Commit', value: SHORT_SHA ? `[\`${SHORT_SHA}\`](${commitUrl})` : '—', inline: true },
      { name: '📋 Tableau de bord', value: `[Dashboard](${WEBSITE}/dashboard.html)`, inline: true }
    ],
    footer: { text: 'Nova Stream — déploiement GitHub Pages' },
    timestamp: new Date().toISOString()
  }]
}

postEmbed(buildEmbed()).catch((err) => {
  console.error('[post-site-update]', err.message || err)
  process.exit(1)
})
