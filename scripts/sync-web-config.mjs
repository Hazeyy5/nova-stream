import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const platform = JSON.parse(readFileSync(join(root, 'shared/platform.json'), 'utf-8'))

const repoMatch = (platform.githubUrl || '').match(/github\.com\/([^/]+\/[^/]+)/)
const githubRepo = repoMatch ? repoMatch[1] : 'Hazeyy5/nova-stream'

const config = `// Généré depuis shared/platform.json — ne pas éditer manuellement
// Exécutez: npm run sync-config
window.NOVA_CONFIG = {
  TWITCH_CLIENT_ID: '${platform.twitchClientId || 'YOUR_TWITCH_CLIENT_ID'}',
  BASE_PATH: '/nova-stream',
  WEBSITE_URL: '${platform.websiteUrl}',
  GITHUB_URL: '${platform.githubUrl || 'https://github.com/Hazeyy5/nova-stream'}',
  GITHUB_REPO: '${githubRepo}',
  APP_VERSION: '${platform.version || '0.0.0'}',
  DESKTOP_LINK_URL: 'http://127.0.0.1:3847',
  DONATIONS_API_URL: '${(platform.donationsApiUrl || '').replace(/'/g, "\\'")}',
  DISCORD_COMMUNITY_URL: '${(platform.discordCommunityInviteUrl || '').replace(/'/g, "\\'")}',
  SCOPES: [
    'user:read:email',
    'chat:read',
    'chat:edit',
    'user:write:chat',
    'channel:read:subscriptions',
    'moderator:read:followers',
    'channel:read:stream_key',
    'channel:manage:broadcast',
    'channel:read:redemptions'
  ].join(' ')
}
`

writeFileSync(join(root, 'docs/js/config.js'), config)
console.log('✓ docs/js/config.js synchronisé')
