import { useEffect } from 'react'

interface ShortcutHandlers {
  onSceneHotkey?: (index: number) => void
  onToggleRecord?: () => void
  onToggleStream?: () => void
  onDeleteSource?: () => void
  onDuplicateSource?: () => void
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        handlers.onSceneHotkey?.(Number(e.key) - 1)
        return
      }

      if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault()
        handlers.onToggleRecord?.()
        return
      }

      if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault()
        handlers.onToggleStream?.()
        return
      }

      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        handlers.onDuplicateSource?.()
        return
      }

      if (e.key === 'Delete') {
        handlers.onDeleteSource?.()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers, enabled])
}
