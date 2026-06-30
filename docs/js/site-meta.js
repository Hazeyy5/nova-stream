;(function () {
  const DEFAULT_OG_IMAGE = '/assets/logo.png'

  function asset(path) {
    return (window.NovaAuth?.asset?.(path)) || path
  }

  function siteOrigin() {
    const base = (window.NOVA_CONFIG?.WEBSITE_URL || '').replace(/\/$/, '')
    if (base) return base
    return `${location.origin}${window.NOVA_CONFIG?.BASE_PATH || ''}`.replace(/\/$/, '')
  }

  function upsertMeta(attr, key, content) {
    if (!content) return
    let el = document.querySelector(`meta[${attr}="${key}"]`)
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute(attr, key)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }

  function applyPageMeta(options = {}) {
    const title = options.title || document.title
    const description = options.description || ''
    const path = options.path || location.pathname
    const image = options.image || `${siteOrigin()}${asset(DEFAULT_OG_IMAGE)}`
    const url = `${siteOrigin()}${path.startsWith('/') ? path : `/${path}`}`

    if (options.title) document.title = options.title

    upsertMeta('name', 'description', description)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', options.type || 'website')
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', image)
    upsertMeta('property', 'og:locale', 'fr_FR')
    upsertMeta('name', 'twitter:card', 'summary')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', image)
  }

  function applyVersionBadges() {
    const version = window.NOVA_CONFIG?.APP_VERSION
    if (!version) return
    document.querySelectorAll('[data-version-badge]').forEach((el) => {
      const suffix = el.dataset.versionSuffix || 'Studio NEXUS'
      el.textContent = `v${version}${suffix ? ` — ${suffix}` : ''}`
    })
    document.querySelectorAll('[data-app-version]').forEach((el) => {
      el.textContent = `v${version}`
    })
  }

  window.NovaSiteMeta = { applyPageMeta, applyVersionBadges, siteOrigin }
})()
