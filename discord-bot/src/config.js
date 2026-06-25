import 'dotenv/config'

export const TOKEN = process.env.DISCORD_TOKEN?.trim()
export const GUILD_ID = process.env.DISCORD_GUILD_ID?.trim() || null
export const WEBSITE_URL = process.env.NOVA_WEBSITE_URL?.trim() || 'https://hazeyy5.github.io/nova-stream'
export const GITHUB_URL = process.env.NOVA_GITHUB_URL?.trim() || 'https://github.com/Hazeyy5/nova-stream'

export const SETUP_MARKER = 'nova-stream-setup-v1'

export function assertToken() {
  if (!TOKEN) {
    console.error('[Nova Discord] DISCORD_TOKEN manquant — copiez discord-bot/.env.example vers discord-bot/.env')
    process.exit(1)
  }
}
