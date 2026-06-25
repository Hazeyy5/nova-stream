;(function () {
  function applyDiscordLinks() {
    const communityUrl = (window.NOVA_CONFIG?.DISCORD_COMMUNITY_URL || '').trim()

    document.querySelectorAll('[data-discord-community], #btn-discord-community').forEach((el) => {
      if (communityUrl) {
        el.href = communityUrl
        el.style.display = el.classList.contains('discord-section') ? '' : el.style.display || ''
        el.removeAttribute('hidden')
      } else {
        el.style.display = 'none'
      }
    })

    document.querySelectorAll('[data-discord-hidden-without-url]').forEach((el) => {
      el.hidden = !communityUrl
    })

    const footerDiscord = document.getElementById('footer-discord')
    if (footerDiscord && communityUrl) {
      footerDiscord.href = communityUrl
      footerDiscord.target = '_blank'
      footerDiscord.rel = 'noopener'
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDiscordLinks)
  } else {
    applyDiscordLinks()
  }

  window.NovaDiscordLinks = { apply: applyDiscordLinks }
})()
