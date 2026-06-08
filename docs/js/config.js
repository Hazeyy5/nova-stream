// Remplacez YOUR_TWITCH_CLIENT_ID par votre Client ID Twitch
// Redirect URI à configurer sur dev.twitch.tv :
//   https://hazeyy5.github.io/nova-stream/oauth/callback.html
window.NOVA_CONFIG = {
  TWITCH_CLIENT_ID: 'YOUR_TWITCH_CLIENT_ID',
  BASE_PATH: '/nova-stream',
  DESKTOP_LINK_URL: 'http://127.0.0.1:3847',
  SCOPES: [
    'user:read:email',
    'chat:read',
    'channel:read:subscriptions',
    'moderator:read:followers'
  ].join(' ')
}
