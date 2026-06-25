;(function () {
  function applyDiscordLinks() {
    const cfg = window.NOVA_CONFIG || {}
    const botUrl = cfg.DISCORD_BOT_INVITE_URL
    const communityUrl = cfg.DISCORD_COMMUNITY_URL

    document.querySelectorAll('#btn-discord-bot, [data-discord-bot-invite]').forEach((el) => {
      if (botUrl) {
        el.href = botUrl
        el.style.display = ''
      } else {
        el.style.display = 'none'
      }
    })

    document.querySelectorAll('#btn-discord-community, [data-discord-community]').forEach((el) => {
      if (communityUrl) {
        el.href = communityUrl
        el.style.display = ''
      } else {
        el.style.display = 'none'
      }
    })

    const footerDiscord = document.getElementById('footer-discord')
    if (footerDiscord) {
      if (communityUrl) {
        footerDiscord.href = communityUrl
        footerDiscord.target = '_blank'
        footerDiscord.rel = 'noopener'
      } else if (botUrl) {
        footerDiscord.href = '#discord'
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDiscordLinks)
  } else {
    applyDiscordLinks()
  }

  window.NovaDiscordLinks = { apply: applyDiscordLinks }
})()
