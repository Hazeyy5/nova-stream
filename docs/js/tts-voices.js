;(function () {
  const WINDOWS_PRESETS = [
    { name: 'Microsoft Denise Online (Natural) - French (France)', label: 'Denise (naturelle)', lang: 'fr-FR' },
    { name: 'Microsoft Henri Online (Natural) - French (France)', label: 'Henri (naturel)', lang: 'fr-FR' },
    { name: 'Microsoft Julie - French (France)', label: 'Julie', lang: 'fr-FR' },
    { name: 'Microsoft Paul - French (France)', label: 'Paul', lang: 'fr-FR' },
    { name: 'Microsoft Catherine - French (Canada)', label: 'Catherine (CA)', lang: 'fr-CA' },
    { name: 'Microsoft Sylvie Online (Natural) - French (Canada)', label: 'Sylvie (naturelle, CA)', lang: 'fr-CA' }
  ]

  function browserVoices() {
    return window.speechSynthesis?.getVoices?.() ?? []
  }

  function buildVoiceOptions(selected) {
    const seen = new Set()
    const out = [{ value: '', label: 'Voix française par défaut (auto)' }]

    const push = (value, label) => {
      if (!value || seen.has(value)) return
      seen.add(value)
      out.push({ value, label })
    }

    for (const p of WINDOWS_PRESETS) {
      push(p.name, `${p.label} — Windows`)
    }

    const fr = browserVoices().filter((v) => v.lang.startsWith('fr'))
    const list = fr.length ? fr : browserVoices()
    for (const v of list) {
      push(v.name, `${v.name} (aperçu navigateur)`)
    }

    if (selected && !seen.has(selected)) {
      push(selected, `${selected} (sauvegardée)`)
    }
    return out
  }

  function populateVoiceSelect(selectEl, selected) {
    if (!selectEl) return
    const options = buildVoiceOptions(selected)
    selectEl.innerHTML = options.map((o) =>
      `<option value="${o.value.replace(/"/g, '&quot;')}"${o.value === (selected ?? '') ? ' selected' : ''}>${o.label}</option>`
    ).join('')
  }

  function initVoiceSelect(selectEl, selected, onChange) {
    populateVoiceSelect(selectEl, selected)
    const refresh = () => populateVoiceSelect(selectEl, selectEl.value || selected)
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = refresh
    }
    selectEl?.addEventListener('change', () => onChange?.(selectEl.value))
    setTimeout(refresh, 250)
    setTimeout(refresh, 1000)
  }

  window.NovaTtsVoices = {
    WINDOWS_PRESETS,
    buildVoiceOptions,
    populateVoiceSelect,
    initVoiceSelect,
    browserVoices
  }
})()
