import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const platform = JSON.parse(readFileSync(join(root, 'shared/platform.json'), 'utf-8'))

const config = `// Généré depuis shared/platform.json — ne pas éditer manuellement
// Exécutez: npm run sync-config
window.NOVA_CONFIG = {
  TWITCH_CLIENT_ID: '${platform.twitchClientId || 'YOUR_TWITCH_CLIENT_ID'}',
  BASE_PATH: '/nova-stream',
  WEBSITE_URL: '${platform.websiteUrl}',
  DESKTOP_LINK_URL: 'http://127.0.0.1:3847',
  SCOPES: [
    'user:read:email',
    'chat:read',
    'chat:edit',
    'user:write:chat',
    'channel:read:subscriptions',
    'moderator:read:followers',
    'channel:read:stream_key',
    'channel:manage:broadcast'
  ].join(' ')
}
`

writeFileSync(join(root, 'docs/js/config.js'), config)
console.log('✓ docs/js/config.js synchronisé')
