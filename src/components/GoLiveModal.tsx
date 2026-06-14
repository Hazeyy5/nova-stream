import { useCallback, useEffect, useRef, useState } from 'react'
import type { StreamSettings, TwitchCategory } from '../types'
import './SettingsModal.css'
import './GoLiveModal.css'

interface GoLiveModalProps {
  mode?: 'go-live' | 'edit-live'
  settings: StreamSettings
  twitchConnected: boolean
  onClose: () => void
  onConfirm: (payload: {
    title: string
    categoryId: string
    categoryName: string
    recordAlso?: boolean
  }) => Promise<void>
}

const TITLE_MAX = 140

export default function GoLiveModal({
  mode = 'go-live',
  settings,
  twitchConnected,
  onClose,
  onConfirm
}: GoLiveModalProps) {
  const isEditMode = mode === 'edit-live'
  const [title, setTitle] = useState(settings.streamTitle)
  const [recordAlso, setRecordAlso] = useState(false)
  const [categoryId, setCategoryId] = useState(settings.streamCategoryId)
  const [categoryName, setCategoryName] = useState(settings.streamCategoryName)
  const [categoryQuery, setCategoryQuery] = useState(settings.streamCategoryName)
  const [results, setResults] = useState<TwitchCategory[]>([])
  const [loadingInfo, setLoadingInfo] = useState(twitchConnected)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!twitchConnected) {
      setLoadingInfo(false)
      return
    }

    let cancelled = false
    setError(null)

    if (isEditMode) {
      setTitle(settings.streamTitle)
      setCategoryId(settings.streamCategoryId)
      setCategoryName(settings.streamCategoryName)
      setCategoryQuery(settings.streamCategoryName)
    }

    setLoadingInfo(true)

    window.novaStream.integrations.getTwitchChannelInfo()
      .then((result) => {
        if (cancelled) return
        if (!result.success || !result.info) {
          setError(result.message ?? 'Impossible de charger les infos Twitch')
          return
        }
        setTitle(result.info.title || settings.streamTitle)
        setCategoryId(result.info.categoryId || settings.streamCategoryId)
        setCategoryName(result.info.categoryName || settings.streamCategoryName)
        setCategoryQuery(result.info.categoryName || settings.streamCategoryName)
      })
      .finally(() => {
        if (!cancelled) setLoadingInfo(false)
      })

    return () => { cancelled = true }
  }, [twitchConnected, isEditMode, settings.streamTitle, settings.streamCategoryId, settings.streamCategoryName])

  const runSearch = useCallback(async (query: string) => {
    if (!twitchConnected || !query.trim()) {
      setResults([])
      return
    }

    setSearching(true)
    try {
      const result = await window.novaStream.integrations.searchTwitchCategories(query)
      if (result.success && result.categories) {
        setResults(result.categories)
        setShowResults(true)
      } else {
        setResults([])
        setError(result.message ?? 'Recherche échouée')
      }
    } finally {
      setSearching(false)
    }
  }, [twitchConnected])

  const handleCategoryInput = (value: string) => {
    setCategoryQuery(value)
    setError(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      void runSearch(value)
    }, 300)
  }

  const selectCategory = (cat: TwitchCategory) => {
    setCategoryId(cat.id)
    setCategoryName(cat.name)
    setCategoryQuery(cat.name)
    setResults([])
    setShowResults(false)
  }

  const handleSubmit = async () => {
    setError(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Indiquez un titre pour votre live.')
      return
    }
    if (trimmedTitle.length > TITLE_MAX) {
      setError(`Le titre ne peut pas dépasser ${TITLE_MAX} caractères.`)
      return
    }
    if (twitchConnected && !categoryId) {
      setError('Choisissez une catégorie Twitch.')
      return
    }

    setSubmitting(true)
    try {
      await onConfirm({
        title: trimmedTitle,
        categoryId,
        categoryName,
        ...(isEditMode ? {} : { recordAlso })
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : isEditMode ? 'Mise à jour échouée' : 'Erreur au démarrage')
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal go-live-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? 'Infos du live' : 'Préparer le live'}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>

        <div className="go-live-body">
          {loadingInfo ? (
            <p className="go-live-hint">Chargement des infos Twitch…</p>
          ) : (
            <>
              <label className="go-live-field">
                Titre du live
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex. On farm tranquillement ce soir"
                  maxLength={TITLE_MAX}
                  autoFocus
                />
                <span className="go-live-char-count">{title.length}/{TITLE_MAX}</span>
              </label>

              {twitchConnected ? (
                <label className="go-live-field">
                  Catégorie Twitch
                  <div className="go-live-category-wrap">
                    <input
                      value={categoryQuery}
                      onChange={(e) => handleCategoryInput(e.target.value)}
                      onFocus={() => categoryQuery && setShowResults(true)}
                      placeholder="Rechercher une catégorie (jeu, IRL, musique…)"
                    />
                    {categoryName && categoryId && (
                      <span className="go-live-category-selected">✓ {categoryName}</span>
                    )}
                    {showResults && results.length > 0 && (
                      <ul className="go-live-category-results">
                        {results.map((cat) => (
                          <li key={cat.id}>
                            <button type="button" onClick={() => selectCategory(cat)}>
                              {cat.boxArtUrl && (
                                <img src={cat.boxArtUrl.replace('{width}', '52').replace('{height}', '72')} alt="" />
                              )}
                              <span>{cat.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {searching && <span className="go-live-searching">Recherche…</span>}
                  </div>
                </label>
              ) : (
                <p className="go-live-hint">
                  Connectez Twitch dans Apps pour définir la catégorie sur Twitch.
                </p>
              )}

              {!isEditMode && (
                <label className="go-live-checkbox">
                  <input
                    type="checkbox"
                    checked={recordAlso}
                    onChange={(e) => setRecordAlso(e.target.checked)}
                  />
                  <span>Enregistrer aussi pendant le live</span>
                </label>
              )}
            </>
          )}

          {error && <p className="go-live-error">{error}</p>}
        </div>

        <div className="go-live-actions">
          <button type="button" className="go-live-btn ghost" onClick={onClose} disabled={submitting}>
            Annuler
          </button>
          <button
            type="button"
            className="go-live-btn primary"
            onClick={() => void handleSubmit()}
            disabled={submitting || loadingInfo}
          >
            {submitting
              ? (isEditMode ? 'Mise à jour…' : 'Démarrage…')
              : isEditMode
                ? 'Mettre à jour sur Twitch'
                : recordAlso
                  ? 'Diffuser + enregistrer'
                  : 'Diffuser en direct'}
          </button>
        </div>
      </div>
    </div>
  )
}
