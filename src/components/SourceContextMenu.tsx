import { useEffect, useRef, useState } from 'react'
import type { AlertAnimation, AlertBoxStyle, BlendMode, ChatBoxStyle, ChromaKeySettings, ScaleMode, Source, SourceType } from '../types'
import { ALERT_ANIMATIONS } from '../lib/alertAnimation'
import { ALERT_BOX_STYLES } from '../lib/alertBoxRenderer'
import { CHAT_BOX_STYLES } from '../lib/chatBoxRenderer'
import './SourceContextMenu.css'

const CHROMA_MEDIA_TYPES: SourceType[] = ['webcam', 'image', 'screen', 'window', 'browser', 'display']

const DEFAULT_CHROMA: ChromaKeySettings = {
  enabled: true,
  color: '#00ff00',
  similarity: 0.4,
  smoothness: 0.12
}

export interface SourceContextMenuState {
  sourceId: string
  x: number
  y: number
}

interface SourceContextMenuProps {
  source: Source
  position: { x: number; y: number }
  onClose: () => void
  onUpdate: (partial: Partial<Source>) => void
  onRemove: () => void
  onDuplicate: () => void
  onRename: () => void
  onProperties: () => void
  onToggleVisible: () => void
  onToggleLock: () => void
  onRecapture?: (kind: 'screen' | 'window') => void
}

interface MenuItemDef {
  id: string
  label: string
  shortcut?: string
  dividerBefore?: boolean
  disabled?: boolean
  submenu?: { id: string; label: string; checked?: boolean }[]
  action?: () => void
}

export default function SourceContextMenu({
  source,
  position,
  onClose,
  onUpdate,
  onRemove,
  onDuplicate,
  onRename,
  onProperties,
  onToggleVisible,
  onToggleLock,
  onRecapture
}: SourceContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(position)
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const t = source.transform

  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 8
    let x = position.x
    let y = position.y
    if (x + rect.width > window.innerWidth - pad) x = window.innerWidth - rect.width - pad
    if (y + rect.height > window.innerHeight - pad) y = window.innerHeight - rect.height - pad
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) })
  }, [position])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [onClose])

  const setTransform = (patch: Partial<typeof t>) => {
    onUpdate({ transform: { ...t, ...patch } })
    onClose()
  }

  const setScaleMode = (scaleMode: ScaleMode) => {
    onUpdate({ scaleMode })
    onClose()
  }

  const setBlendMode = (blendMode: BlendMode) => {
    onUpdate({ blendMode })
    onClose()
  }

  const items: MenuItemDef[] = [
    {
      id: 'transform',
      label: 'Transformer',
      submenu: [
        { id: 'fs', label: 'Plein écran' },
        { id: 'center', label: 'Centrer' },
        { id: 'facecam', label: 'Facecam' },
        { id: 'tl', label: 'Coin haut gauche' },
        { id: 'tr', label: 'Coin haut droit' },
        { id: 'bl', label: 'Coin bas gauche' },
        { id: 'br', label: 'Coin bas droit' },
        { id: 'flip-h', label: 'Retourner horizontalement' },
        { id: 'flip-v', label: 'Retourner verticalement' }
      ]
    },
    {
      id: 'group',
      label: 'Grouper',
      disabled: true,
      submenu: [{ id: 'soon', label: 'Bientôt disponible' }]
    },
    {
      id: 'scale',
      label: 'Filtre de mise à l\'échelle',
      dividerBefore: true,
      submenu: [
        { id: 'stretch', label: 'Déformation', checked: (source.scaleMode ?? 'stretch') === 'stretch' },
        { id: 'fit', label: 'Ajuster', checked: source.scaleMode === 'fit' },
        { id: 'fill', label: 'Remplir', checked: source.scaleMode === 'fill' }
      ]
    },
    {
      id: 'blend',
      label: 'Mode de fusion',
      submenu: [
        { id: 'normal', label: 'Normal', checked: (source.blendMode ?? 'normal') === 'normal' },
        { id: 'multiply', label: 'Multiplier', checked: source.blendMode === 'multiply' },
        { id: 'screen', label: 'Écran', checked: source.blendMode === 'screen' }
      ]
    },
    {
      id: 'show',
      label: source.visible ? 'Masquer' : 'Afficher',
      action: () => { onToggleVisible(); onClose() }
    },
    {
      id: 'delete',
      label: 'Supprimer',
      shortcut: 'Suppr',
      action: () => { onRemove(); onClose() }
    },
    {
      id: 'lock',
      label: source.locked ? 'Déverrouiller' : 'Verrouiller',
      action: () => { onToggleLock(); onClose() }
    },
    {
      id: 'duplicate',
      label: 'Dupliquer',
      shortcut: 'Ctrl+D',
      action: () => { onDuplicate(); onClose() }
    },
    {
      id: 'rename',
      label: 'Renommer',
      action: () => { onRename(); onClose() }
    },
    {
      id: 'filters',
      label: 'Filtres',
      disabled: !CHROMA_MEDIA_TYPES.includes(source.type),
      submenu: [
        {
          id: 'chroma-toggle',
          label: source.chromaKey?.enabled ? 'Désactiver chroma key' : 'Activer chroma key',
          checked: !!source.chromaKey?.enabled
        },
        {
          id: 'chroma-green',
          label: 'Fond vert',
          checked: source.chromaKey?.enabled && source.chromaKey.color === '#00ff00'
        },
        {
          id: 'chroma-blue',
          label: 'Fond bleu',
          checked: source.chromaKey?.enabled && source.chromaKey.color === '#0000ff'
        }
      ]
    },
    {
      id: 'properties',
      label: 'Propriétés',
      action: () => { onProperties(); onClose() }
    }
  ]

  if (source.type === 'chat') {
    items.splice(items.length - 1, 0, {
      id: 'chat-style',
      label: 'Design du chat',
      submenu: CHAT_BOX_STYLES.map((s) => ({
        id: s.id,
        label: s.label,
        checked: (source.chatStyle ?? 'classic') === s.id
      }))
    })
  }

  if (source.type === 'alert') {
    items.splice(items.length - 1, 0, {
      id: 'alert-style',
      label: 'Design des alertes',
      submenu: ALERT_BOX_STYLES.map((s) => ({
        id: s.id,
        label: s.label,
        checked: (source.alertStyle ?? 'classic') === s.id
      }))
    })
    items.splice(items.length - 1, 0, {
      id: 'alert-animation',
      label: 'Animation des alertes',
      submenu: ALERT_ANIMATIONS.map((s) => ({
        id: s.id,
        label: s.label,
        checked: (source.alertAnimation ?? 'pop') === s.id
      }))
    })
  }

  if (source.type === 'screen' || source.type === 'window') {
    items.splice(items.length - 1, 0, {
      id: 'recapture',
      label: 'Re-choisir la capture',
      action: () => { onRecapture?.(source.type as 'screen' | 'window'); onClose() }
    })
  }

  const handleSubmenuAction = (parentId: string, subId: string) => {
    if (parentId === 'transform') {
      const t = source.transform
      if (subId === 'fs') setTransform({ x: 0, y: 0, width: 100, height: 100 })
      if (subId === 'center') setTransform({ x: 37.5, y: 37.5, width: 25, height: 25 })
      if (subId === 'facecam') setTransform({ x: 72, y: 68, width: 22, height: 22 })
      if (subId === 'tl') setTransform({ ...t, x: 0, y: 0 })
      if (subId === 'tr') setTransform({ ...t, x: 100 - t.width, y: 0 })
      if (subId === 'bl') setTransform({ ...t, x: 0, y: 100 - t.height })
      if (subId === 'br') setTransform({ ...t, x: 100 - t.width, y: 100 - t.height })
      if (subId === 'flip-h') onUpdate({ flipH: !source.flipH }); onClose()
      if (subId === 'flip-v') onUpdate({ flipV: !source.flipV }); onClose()
    }
    if (parentId === 'scale') setScaleMode(subId as ScaleMode)
    if (parentId === 'blend') setBlendMode(subId as BlendMode)
    if (parentId === 'chat-style') {
      onUpdate({ chatStyle: subId as ChatBoxStyle })
      onClose()
    }
    if (parentId === 'alert-style') {
      onUpdate({ alertStyle: subId as AlertBoxStyle })
      onClose()
    }
    if (parentId === 'alert-animation') {
      onUpdate({ alertAnimation: subId as AlertAnimation })
      onClose()
    }
    if (parentId === 'filters') {
      if (subId === 'chroma-toggle') {
        onUpdate({
          chromaKey: source.chromaKey?.enabled
            ? { ...source.chromaKey, enabled: false }
            : { ...(source.chromaKey ?? DEFAULT_CHROMA), enabled: true }
        })
      }
      if (subId === 'chroma-green') {
        onUpdate({ chromaKey: { ...(source.chromaKey ?? DEFAULT_CHROMA), enabled: true, color: '#00ff00' } })
      }
      if (subId === 'chroma-blue') {
        onUpdate({ chromaKey: { ...(source.chromaKey ?? DEFAULT_CHROMA), enabled: true, color: '#0000ff' } })
      }
      onClose()
    }
  }

  return (
    <div
      ref={menuRef}
      className="source-ctx-menu"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <div key={item.id} className="source-ctx-item-wrap">
          {item.dividerBefore && <div className="source-ctx-divider" />}
          <button
            type="button"
            className={`source-ctx-item ${item.disabled ? 'disabled' : ''} ${openSubmenu === item.id ? 'open' : ''}`}
            disabled={item.disabled}
            onMouseEnter={() => item.submenu && setOpenSubmenu(item.id)}
            onClick={() => !item.submenu && item.action?.()}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="source-ctx-shortcut">{item.shortcut}</span>}
            {item.submenu && <span className="source-ctx-arrow">▸</span>}
          </button>
          {item.submenu && openSubmenu === item.id && !item.disabled && (
            <div
              className="source-ctx-submenu"
              onMouseLeave={() => setOpenSubmenu(null)}
            >
              {item.submenu.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  className={`source-ctx-item ${sub.id === 'soon' ? 'disabled' : ''}`}
                  disabled={sub.id === 'soon'}
                  onClick={() => handleSubmenuAction(item.id, sub.id)}
                >
                  <span>{sub.checked ? '✓ ' : ''}{sub.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
