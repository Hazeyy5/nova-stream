import logoUrl from '../assets/logo.png'
import './WelcomeModal.css'

interface WelcomeModalProps {
  onClose: () => void
  onOpenIntegrations: () => void
  websiteUrl: string
}

export default function WelcomeModal({ onClose, onOpenIntegrations, websiteUrl }: WelcomeModalProps) {
  return (
    <div className="welcome-overlay">
      <div className="welcome-modal">
        <div className="welcome-header">
          <img src={logoUrl} alt="" className="welcome-logo" width={56} height={56} draggable={false} />
          <h2>Bienvenue sur Nova Stream</h2>
          <p>Votre studio de streaming gratuit, pour tout le monde.</p>
        </div>

        <div className="welcome-steps">
          <div className="welcome-step">
            <span className="welcome-step-num">1</span>
            <div>
              <strong>Connectez Twitch</strong>
              <p>Via le site Nova Stream, puis liez votre compte à l&apos;application.</p>
            </div>
          </div>
          <div className="welcome-step">
            <span className="welcome-step-num">2</span>
            <div>
              <strong>Composez votre scène</strong>
              <p>Écran, webcam, chat et alertes — tout est prêt.</p>
            </div>
          </div>
          <div className="welcome-step">
            <span className="welcome-step-num">3</span>
            <div>
              <strong>Diffusez</strong>
              <p>Cliquez « Diffuser en direct » et c'est parti !</p>
            </div>
          </div>
        </div>

        <div className="welcome-note">
          <strong>🔒 Vos données restent chez vous</strong>
          <p>
            Chaque utilisateur a sa propre session locale. Vos tokens Twitch et paramètres
            sont stockés uniquement sur votre PC — pas de compte cloud obligatoire.
          </p>
        </div>

        <div className="welcome-actions">
          <button className="welcome-btn primary" onClick={onOpenIntegrations}>
            Se connecter avec Twitch
          </button>
          <a href={websiteUrl} target="_blank" rel="noreferrer" className="welcome-btn secondary">
            Ouvrir le site Nova Stream
          </a>
          <button className="welcome-btn ghost" onClick={onClose}>
            Commencer →
          </button>
        </div>
      </div>
    </div>
  )
}
