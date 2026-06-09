import type { Source } from '../types'
import { useSourcePreview } from '../hooks/useSourcePreview'
import './SourcePreview.css'

interface SourcePreviewProps {
  source: Source
}

export default function SourcePreview({ source }: SourcePreviewProps) {
  const canvasRef = useSourcePreview(source)

  return (
    <div className="source-preview">
      <canvas ref={canvasRef} className="source-preview-canvas" />
    </div>
  )
}
