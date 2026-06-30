import 'dotenv/config'

export const TOKEN = process.env.DISCORD_TOKEN?.trim()
export const GUILD_ID = process.env.DISCORD_GUILD_ID?.trim() || null
export const WEBSITE_URL = process.env.NOVA_WEBSITE_URL?.trim() || 'https://hazeyy5.github.io/nova-stream'
export const GITHUB_URL = process.env.NOVA_GITHUB_URL?.trim() || 'https://github.com/Hazeyy5/nova-stream'
export const APP_VERSION = process.env.NOVA_APP_VERSION?.trim() || '0.9.0'
export const DONATIONS_API_URL = process.env.NOVA_DONATIONS_API_URL?.trim() || 'https://nova-stream-donations.contact-delaplacetheo.workers.dev'

export const SETUP_MARKER = 'nova-stream-setup-v1'

export function assertConfig() {
  if (!TOKEN) {
    console.error('[Nova Discord] DISCORD_TOKEN manquant — copiez discord-bot/.env.example vers discord-bot/.env')
    process.exit(1)
  }
  if (!GUILD_ID) {
    console.error('[Nova Discord] DISCORD_GUILD_ID manquant — ID du serveur Nova Stream (clic droit → Copier l\'identifiant du serveur)')
    process.exit(1)
  }
}

export function isNovaGuild(guildId) {
  return guildId === GUILD_ID
}
