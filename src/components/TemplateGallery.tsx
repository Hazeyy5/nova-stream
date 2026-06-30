import { SCENE_TEMPLATES, type SceneTemplateId } from '../lib/sceneTemplates'
import './TemplateGallery.css'

interface TemplateGalleryProps {
  selectedId: SceneTemplateId
  onSelect: (id: SceneTemplateId) => void
  compact?: boolean
}

export default function TemplateGallery({ selectedId, onSelect, compact = false }: TemplateGalleryProps) {
  return (
    <div className={`template-gallery${compact ? ' compact' : ''}`}>
      {SCENE_TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          className={`template-gallery-card${selectedId === template.id ? ' selected' : ''}`}
          onClick={() => onSelect(template.id)}
        >
          <span className="template-gallery-icon">{template.icon}</span>
          <div className="template-gallery-body">
            <strong>{template.name}</strong>
            <p>{template.description}</p>
            <ul className="template-gallery-scenes">
              {template.liveScenes.map((scene) => (
                <li key={scene}>{scene}</li>
              ))}
            </ul>
          </div>
        </button>
      ))}
    </div>
  )
}
