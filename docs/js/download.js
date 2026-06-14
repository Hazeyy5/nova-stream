(function () {
  const config = window.NOVA_CONFIG || {}
  const repo = config.GITHUB_REPO || 'Hazeyy5/nova-stream'
  const githubUrl = config.GITHUB_URL || `https://github.com/${repo}`
  const releasesUrl = `${githubUrl}/releases`

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  function pickWindowsAsset(assets) {
    if (!assets?.length) return null
    return assets.find((a) => /\.exe$/i.test(a.name)) || assets[0]
  }

  function applyDownloadState(state) {
    const buttons = document.querySelectorAll('[data-download-btn]')
    const hints = document.querySelectorAll('[data-download-hint]')
    const badges = document.querySelectorAll('[data-version-badge]')

    for (const badge of badges) {
      if (state.version) badge.textContent = `v${state.version} — Studio NEXUS`
    }

    for (const btn of buttons) {
      if (state.available && state.url) {
        btn.href = state.url
        btn.classList.remove('is-disabled')
        btn.removeAttribute('aria-disabled')
        const label = btn.dataset.downloadLabel || 'Télécharger pour Windows'
        const size = state.size ? ` (${state.size})` : ''
        btn.innerHTML = btn.dataset.downloadIcon
          ? `${btn.dataset.downloadIcon}${label}${size}`
          : `${label}${size}`
      } else {
        btn.href = releasesUrl
        btn.classList.add('is-disabled')
        btn.setAttribute('aria-disabled', 'true')
        btn.textContent = 'Voir les releases GitHub'
      }
    }

    for (const hint of hints) {
      if (state.available) {
        hint.textContent = state.version
          ? `Installateur Windows · v${state.version}${state.size ? ` · ${state.size}` : ''} · Gratuit`
          : 'Installateur Windows · Gratuit'
      } else {
        hint.textContent = 'Aucune release publiée pour le moment — consultez GitHub.'
      }
    }
  }

  async function loadLatestRelease() {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' }
      })
      if (!res.ok) throw new Error('no release')
      const data = await res.json()
      const asset = pickWindowsAsset(data.assets)
      if (!asset) throw new Error('no asset')
      applyDownloadState({
        available: true,
        url: asset.browser_download_url,
        version: (data.tag_name || '').replace(/^v/, ''),
        size: formatBytes(asset.size)
      })
    } catch {
      applyDownloadState({ available: false })
    }
  }

  window.NovaDownload = { loadLatestRelease, releasesUrl }
  document.addEventListener('DOMContentLoaded', () => { void loadLatestRelease() })
})()
