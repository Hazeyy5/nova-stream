import { useEffect, useRef, useState } from 'react'
import type { BlendMode, ScaleMode, Source } from '../types'
import './SourceContextMenu.css'

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
      disabled: true,
      submenu: [{ id: 'none', label: 'Aucun filtre' }]
    },
    {
      id: 'properties',
      label: 'Propriétés',
      action: () => { onProperties(); onClose() }
    }
  ]

  if (source.type === 'screen' || source.type === 'window') {
    items.splice(items.length - 1, 0, {
      id: 'recapture',
      label: 'Re-choisir la capture',
      action: () => { onRecapture?.(source.type as 'screen' | 'window'); onClose() }
    })
  }

  const handleSubmenuAction = (parentId: string, subId: string) => {
    if (parentId === 'transform') {
      if (subId === 'fs') setTransform({ x: 0, y: 0, width: 100, height: 100 })
      if (subId === 'center') setTransform({ x: 37.5, y: 37.5, width: 25, height: 25 })
      if (subId === 'facecam') setTransform({ x: 72, y: 68, width: 22, height: 22 })
      if (subId === 'flip-h') onUpdate({ flipH: !source.flipH }); onClose()
      if (subId === 'flip-v') onUpdate({ flipV: !source.flipV }); onClose()
    }
    if (parentId === 'scale') setScaleMode(subId as ScaleMode)
    if (parentId === 'blend') setBlendMode(subId as BlendMode)
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
