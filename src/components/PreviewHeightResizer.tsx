import { useCallback, useEffect, useRef } from 'react'
import './PreviewHeightResizer.css'

interface PreviewHeightResizerProps {
  onResize: (deltaY: number) => void
}

export default function PreviewHeightResizer({ onResize }: PreviewHeightResizerProps) {
  const dragging = useRef(false)
  const lastY = useRef(0)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientY - lastY.current
      lastY.current = e.clientY
      onResize(delta)
    }

    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false
        document.body.classList.remove('preview-resizing')
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.classList.remove('preview-resizing')
    }
  }, [onResize])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    lastY.current = e.clientY
    document.body.classList.add('preview-resizing')
    e.preventDefault()
  }, [])

  return (
    <div
      className="preview-height-resizer"
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Redimensionner l'aperçu"
      title="Glisser pour redimensionner l'aperçu"
    />
  )
}
