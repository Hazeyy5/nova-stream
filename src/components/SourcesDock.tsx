import { useState, useRef, useEffect } from 'react'
import type { CaptureSourceOption, Source, SourceType } from '../types'
import { IconCamera, IconDisplay, IconEye, IconImage, IconText, IconTrash } from './Icons'
import SourceContextMenu from './SourceContextMenu'
import CapturePickerModal from './CapturePickerModal'
import BrowserSourceModal from './BrowserSourceModal'
import './DockPanel.css'

interface SourcesDockProps {
  sources: Source[]
  selectedSourceId: string | null
  onSourceSelect: (id: string | null) => void
  onAddSource: (type: SourceType, extra?: Partial<Source>) => void
  onUpdateSource: (id: string, partial: Partial<Source>) => void
  onRemoveSource: (id: string) => void
  onMoveSource: (id: string, dir: 'up' | 'down') => void
  onDuplicateSource: (id: string) => void
  selectedSource: Source | null
}

const SOURCE_GROUPS: {
  title: string
  items: { type: SourceType; label: string; Icon?: typeof IconDisplay; emoji?: string; needsPicker?: 'screen' | 'window' | 'browser' }[]
}[] = [
  {
    title: 'Capture',
    items: [
      { type: 'screen', label: 'Écran', Icon: IconDisplay, needsPicker: 'screen' },
      { type: 'window', label: 'Fenêtre', emoji: '🪟', needsPicker: 'window' },
      { type: 'display', label: 'Sélecteur système', Icon: IconDisplay },
      { type: 'browser', label: 'Navigateur', emoji: '🌐', needsPicker: 'browser' }
    ]
  },
  {
    title: 'Vidéo',
    items: [
      { type: 'webcam', label: 'Webcam', Icon: IconCamera }
    ]
  },
  {
    title: 'Widgets',
    items: [
      { type: 'chat', label: 'Chat Box', emoji: '💬' },
      { type: 'alert', label: 'Alert Box', emoji: '🔔' }
    ]
  },
  {
    title: 'Média',
    items: [
      { type: 'image', label: 'Image', Icon: IconImage },
      { type: 'text', label: 'Texte', Icon: IconText }
    ]
  }
]

export default function SourcesDock(props: SourcesDockProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [pickerKind, setPickerKind] = useState<'screen' | 'window' | null>(null)
  const [recaptureSourceId, setRecaptureSourceId] = useState<string | null>(null)
  const [showBrowserModal, setShowBrowserModal] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ sourceId: string; x: number; y: number } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  const openProperties = (sourceId: string) => {
    const source = props.sources.find((s) => s.id === sourceId)
    if (!source) return
    props.onSourceSelect(sourceId)
    window.novaStream.sourceProps.open(source)
  }

  useEffect(() => {
    const unsubs = [
      window.novaStream.sourceProps.onApplyPatch(({ sourceId, partial }) => {
        props.onUpdateSource(sourceId, partial)
      }),
      window.novaStream.sourceProps.onOpenRecapture(({ sourceId, kind }) => {
        props.onSourceSelect(sourceId)
        setRecaptureSourceId(sourceId)
        setPickerKind(kind)
      })
    ]
    return () => unsubs.forEach((u) => u())
  }, [props.onUpdateSource, props.onSourceSelect])

  useEffect(() => {
    if (renamingId) renameRef.current?.focus()
  }, [renamingId])

  const handlePick = (item: typeof SOURCE_GROUPS[0]['items'][0]) => {
    setShowMenu(false)
    if (item.needsPicker === 'screen' || item.needsPicker === 'window') {
      setPickerKind(item.needsPicker)
      return
    }
    if (item.needsPicker === 'browser') {
      setShowBrowserModal(true)
      return
    }
    props.onAddSource(item.type)
  }

  const handleCaptureSelect = (capture: CaptureSourceOption) => {
    if (!pickerKind) return
    const patch = {
      captureId: capture.id,
      captureName: capture.name,
      name: capture.name.slice(0, 40)
    }
    if (recaptureSourceId) {
      props.onUpdateSource(recaptureSourceId, patch)
      setRecaptureSourceId(null)
    } else {
      props.onAddSource(pickerKind, patch)
    }
    setPickerKind(null)
  }

  const handleBrowserConfirm = (url: string) => {
    props.onAddSource('browser', { browserUrl: url, name: 'Navigateur' })
    setShowBrowserModal(false)
  }

  const openContextMenu = (e: React.MouseEvent, sourceId: string) => {
    e.preventDefault()
    e.stopPropagation()
    props.onSourceSelect(sourceId)
    setContextMenu({ sourceId, x: e.clientX, y: e.clientY })
  }

  const contextSource = contextMenu
    ? props.sources.find((s) => s.id === contextMenu.sourceId)
    : null

  return (
    <div className="dock-panel sources-dock">
      <div className="dock-panel-header">
        <h3>Sources</h3>
        <div className="dock-add-wrap">
          <button className="dock-add-btn" onClick={() => setShowMenu(!showMenu)} title="Ajouter une source">+</button>
          {showMenu && (
            <div className="dock-add-menu dock-add-menu-wide">
              {SOURCE_GROUPS.map((group) => (
                <div key={group.title} className="dock-add-group">
                  <span className="dock-add-group-title">{group.title}</span>
                  {group.items.map((item) => (
                    <button key={item.type + item.label} onClick={() => handlePick(item)}>
                      {item.emoji ? <span>{item.emoji}</span> : item.Icon && <item.Icon size={14} />}
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ul className="dock-list sources-dock-list">
        {props.sources.length === 0 && (
          <li className="dock-empty">Cliquez + pour ajouter une source</li>
        )}
        {[...props.sources].reverse().map((source, idx, arr) => (
          <li
            key={source.id}
            className={`${source.id === props.selectedSourceId ? 'selected' : ''} ${!source.visible ? 'dimmed' : ''}`}
            onContextMenu={(e) => openContextMenu(e, source.id)}
          >
            {renamingId === source.id ? (
              <input
                ref={renameRef}
                className="dock-rename-input source-rename-input"
                defaultValue={source.name}
                onBlur={(e) => {
                  props.onUpdateSource(source.id, { name: e.target.value.trim() || source.name })
                  setRenamingId(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setRenamingId(null)
                }}
              />
            ) : (
              <button
                className="dock-list-btn source-row"
                onClick={() => props.onSourceSelect(source.id)}
                onDoubleClick={() => openProperties(source.id)}
                onContextMenu={(e) => openContextMenu(e, source.id)}
                title="Double-clic pour les propriétés"
              >
                <SourceIcon type={source.type} />
                <span className="source-name">{source.name}</span>
              </button>
            )}
            <div className="source-row-actions">
              <button
                className="dock-item-action"
                onClick={() => openProperties(source.id)}
                title="Propriétés"
              >
                ⚙
              </button>
              <button
                className="dock-item-action"
                onClick={() => props.onUpdateSource(source.id, { visible: !source.visible })}
                title={source.visible ? 'Masquer' : 'Afficher'}
              >
                <IconEye visible={source.visible} size={13} />
              </button>
              <button
                className="dock-item-action"
                onClick={() => props.onUpdateSource(source.id, { locked: !source.locked })}
                title={source.locked ? 'Déverrouiller' : 'Verrouiller'}
              >
                {source.locked ? '🔒' : '🔓'}
              </button>
              <button
                className="dock-item-action"
                onClick={() => props.onDuplicateSource(source.id)}
                title="Dupliquer (Ctrl+D)"
              >⧉</button>
              <button
                className="dock-item-action"
                onClick={() => props.onMoveSource(source.id, 'up')}
                disabled={idx === 0}
              >↑</button>
              <button
                className="dock-item-action"
                onClick={() => props.onMoveSource(source.id, 'down')}
                disabled={idx === arr.length - 1}
              >↓</button>
              <button
                className="dock-item-action danger"
                onClick={() => {
                  window.novaStream.sourceProps.close(source.id)
                  props.onRemoveSource(source.id)
                }}
              >
                <IconTrash size={12} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {contextMenu && contextSource && (
        <SourceContextMenu
          source={contextSource}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onUpdate={(partial) => props.onUpdateSource(contextSource.id, partial)}
          onRemove={() => {
            window.novaStream.sourceProps.close(contextSource.id)
            props.onRemoveSource(contextSource.id)
          }}
          onDuplicate={() => props.onDuplicateSource(contextSource.id)}
          onRename={() => setRenamingId(contextSource.id)}
          onProperties={() => {
            openProperties(contextSource.id)
          }}
          onToggleVisible={() => props.onUpdateSource(contextSource.id, { visible: !contextSource.visible })}
          onToggleLock={() => props.onUpdateSource(contextSource.id, { locked: !contextSource.locked })}
          onRecapture={(kind) => {
            setRecaptureSourceId(contextSource.id)
            setPickerKind(kind)
          }}
        />
      )}

      {pickerKind && (
        <CapturePickerModal
          kind={pickerKind}
          onSelect={handleCaptureSelect}
          onClose={() => { setPickerKind(null); setRecaptureSourceId(null) }}
        />
      )}

      {showBrowserModal && (
        <BrowserSourceModal
          onConfirm={handleBrowserConfirm}
          onClose={() => setShowBrowserModal(false)}
        />
      )}
    </div>
  )
}

function SourceIcon({ type }: { type: SourceType }) {
  const emojis: Partial<Record<SourceType, string>> = {
    chat: '💬', alert: '🔔', browser: '🌐', window: '🪟'
  }
  if (emojis[type]) return <span className="source-icon-wrap">{emojis[type]}</span>
  const map = { display: IconDisplay, screen: IconDisplay, webcam: IconCamera, image: IconImage, text: IconText }
  const Icon = map[type as keyof typeof map]
  return Icon ? <span className="source-icon-wrap"><Icon size={13} /></span> : null
}

