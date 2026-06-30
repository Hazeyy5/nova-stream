import { EmbedBuilder } from 'discord.js'
import { WEBSITE_URL, GITHUB_URL, APP_VERSION, DONATIONS_API_URL } from './config.js'

async function fetchLatestGitHubRelease() {
  try {
    const repo = GITHUB_URL.replace(/https:\/\/github\.com\//, '')
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'NovaStream-Discord-Bot' },
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      tag: data.tag_name || null,
      publishedAt: data.published_at || null,
      url: data.html_url || GITHUB_URL + '/releases'
    }
  } catch {
    return null
  }
}

async function checkDonationsApi() {
  if (!DONATIONS_API_URL) return { ok: false, label: 'Non configuré' }
  try {
    const res = await fetch(`${DONATIONS_API_URL.replace(/\/$/, '')}/v1/health`, {
      signal: AbortSignal.timeout(6000)
    })
    if (!res.ok) return { ok: false, label: 'Indisponible' }
    const data = await res.json()
    return { ok: true, label: data.ok ? 'En ligne' : 'En ligne' }
  } catch {
    return { ok: false, label: 'Hors ligne' }
  }
}

export async function handleNovaStatusCommand(interaction) {
  await interaction.deferReply({ ephemeral: true })

  const [release, donations] = await Promise.all([
    fetchLatestGitHubRelease(),
    checkDonationsApi()
  ])

  const embed = new EmbedBuilder()
    .setTitle('📡 Statut Nova Stream')
    .setColor(0x9146ff)
    .setDescription('État des services et liens utiles.')
    .addFields(
      {
        name: '🖥️ Application',
        value: `Version configurée : **v${APP_VERSION}**${release?.tag ? `\nDernière release GitHub : **${release.tag}**` : ''}`,
        inline: false
      },
      {
        name: '🌐 Site web',
        value: `[Tableau de bord](${WEBSITE_URL}/dashboard.html)`,
        inline: true
      },
      {
        name: '💰 API Dons',
        value: donations.ok ? `✅ ${donations.label}` : `⚠️ ${donations.label}`,
        inline: true
      },
      {
        name: '🤖 Bot Discord',
        value: '✅ En ligne',
        inline: true
      },
      {
        name: '📦 Releases',
        value: release?.url ? `[${release.tag}](${release.url})` : GITHUB_URL + '/releases',
        inline: false
      },
      {
        name: '🎫 Support',
        value: 'Ouvrez un ticket dans `#ouvrir-ticket`',
        inline: false
      }
    )
    .setTimestamp()

  if (release?.publishedAt) {
    embed.setFooter({ text: `Release publiée le ${new Date(release.publishedAt).toLocaleDateString('fr-FR')}` })
  }

  await interaction.editReply({ embeds: [embed] })
  return true
}
