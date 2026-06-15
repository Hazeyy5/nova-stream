import { useState } from 'react'
import type { UserMode } from '../types'
import { SCENE_TEMPLATES, type SceneTemplateId } from '../lib/sceneTemplates'
import logoUrl from '../assets/logo.png'
import './WelcomeModal.css'

export interface WelcomeResult {
  userMode: UserMode
  templateId: SceneTemplateId | null
}

interface WelcomeModalProps {
  onComplete: (result: WelcomeResult) => void
  onConnectTwitch: () => void
}

type Step = 'account' | 'template'

export default function WelcomeModal({ onComplete, onConnectTwitch }: WelcomeModalProps) {
  const [step, setStep] = useState<Step>('account')
  const [userMode, setUserMode] = useState<UserMode | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<SceneTemplateId>('gaming')

  const chooseAccount = (mode: UserMode) => {
    setUserMode(mode)
    if (mode === 'twitch') {
      onConnectTwitch()
    }
    setStep('template')
  }

  const finish = (templateId: SceneTemplateId | null) => {
    if (!userMode) return
    onComplete({ userMode, templateId })
  }

  return (
    <div className="welcome-overlay">
      <div className="welcome-modal">
        <div className="welcome-header">
          <img src={logoUrl} alt="" className="welcome-logo" width={56} height={56} draggable={false} />
          <h2>Bienvenue sur Nova Stream</h2>
          <p>
            {step === 'account'
              ? 'Comment souhaitez-vous utiliser l\'application ?'
              : 'Choisissez un modèle de scènes, ou partez d\'une scène vide'}
          </p>
        </div>

        {step === 'account' && (
          <>
            <div className="welcome-account-grid">
              <button type="button" className="welcome-account-card twitch" onClick={() => chooseAccount('twitch')}>
                <span className="welcome-account-icon">🟣</span>
                <strong>Connecter Twitch</strong>
                <p>Chat, alertes, clé de stream et widgets en direct.</p>
              </button>
              <button type="button" className="welcome-account-card basic" onClick={() => chooseAccount('basic')}>
                <span className="welcome-account-icon">👤</span>
                <strong>Utilisateur basique</strong>
                <p>Composer et diffuser sans compte Twitch pour l&apos;instant.</p>
              </button>
            </div>

            <div className="welcome-note">
              <strong>🔒 Vos données restent chez vous</strong>
              <p>
                Session locale uniquement — tokens et paramètres stockés sur votre PC.
                Vous pourrez connecter Twitch plus tard dans Apps.
              </p>
            </div>
          </>
        )}

        {step === 'template' && (
          <>
            <div className="welcome-template-grid">
              {SCENE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`welcome-template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <span className="welcome-template-icon">{template.icon}</span>
                  <strong>{template.name}</strong>
                  <p>{template.description}</p>
                </button>
              ))}
            </div>

            <div className="welcome-actions welcome-actions-row">
              <button type="button" className="welcome-btn ghost" onClick={() => setStep('account')}>
                ← Retour
              </button>
              <button type="button" className="welcome-btn ghost" onClick={() => finish(null)}>
                Commencer sans modèle
              </button>
              <button type="button" className="welcome-btn primary" onClick={() => finish(selectedTemplate)}>
                Appliquer le modèle →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
