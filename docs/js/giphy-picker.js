;(function () {
  let selectedUrl = ''
  let debounceTimer = null

  function apiBase() {
    return (window.NovaDonations?.apiUrl?.() || '').replace(/\/$/, '')
  }

  async function fetchGifs(query) {
    const base = apiBase()
    if (!base) return []
    const url = new URL(`${base}/v1/giphy/search`)
    if (query?.trim()) url.searchParams.set('q', query.trim())
    url.searchParams.set('limit', '16')
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    if (!data.success) return []
    return data.gifs || []
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function mount(container, options) {
    if (!container) return { getSelected: () => '', clear: () => {} }

    selectedUrl = ''
    const onChange = options?.onChange

    container.innerHTML = `
      <div class="tip-giphy-selected" id="tip-giphy-selected" hidden>
        <img id="tip-giphy-selected-img" alt="" />
        <button type="button" class="tip-giphy-clear" id="tip-giphy-clear">Retirer le GIF</button>
      </div>
      <input type="search" class="tip-giphy-search" id="tip-giphy-search" placeholder="Rechercher sur Giphy…" autocomplete="off" />
      <div class="tip-giphy-grid" id="tip-giphy-grid"></div>
      <p class="tip-giphy-powered">Powered by GIPHY</p>
    `

    const selectedEl = container.querySelector('#tip-giphy-selected')
    const selectedImg = container.querySelector('#tip-giphy-selected-img')
    const clearBtn = container.querySelector('#tip-giphy-clear')
    const searchInput = container.querySelector('#tip-giphy-search')
    const grid = container.querySelector('#tip-giphy-grid')

    function setSelected(url) {
      selectedUrl = url || ''
      if (selectedUrl) {
        selectedImg.src = selectedUrl
        selectedEl.hidden = false
      } else {
        selectedEl.hidden = true
        selectedImg.removeAttribute('src')
      }
      onChange?.(selectedUrl)
    }

    function renderGrid(gifs) {
      if (!gifs.length) {
        grid.innerHTML = '<p class="tip-giphy-empty">Aucun GIF trouvé.</p>'
        return
      }
      grid.innerHTML = gifs.map((g) => `
        <button type="button" class="tip-giphy-item${selectedUrl === g.url ? ' selected' : ''}" data-url="${esc(g.url)}" title="${esc(g.title)}">
          <img src="${esc(g.previewUrl || g.url)}" alt="" loading="lazy" />
        </button>
      `).join('')

      grid.querySelectorAll('.tip-giphy-item').forEach((btn) => {
        btn.addEventListener('click', () => setSelected(btn.dataset.url || ''))
      })
    }

    async function runSearch(query) {
      grid.innerHTML = '<p class="tip-giphy-empty">Chargement…</p>'
      try {
        renderGrid(await fetchGifs(query))
      } catch {
        grid.innerHTML = '<p class="tip-giphy-empty">Impossible de charger Giphy.</p>'
      }
    }

    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => runSearch(searchInput.value), 320)
    })

    clearBtn.addEventListener('click', () => setSelected(''))

    void runSearch('')

    return {
      getSelected: () => selectedUrl,
      clear: () => setSelected('')
    }
  }

  window.NovaGiphyPicker = { mount }
})()
