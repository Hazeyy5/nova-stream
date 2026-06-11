import type { PlatformConnectionPublic } from '../types'
import './IntegrationsPanel.css'

interface IntegrationsPanelProps {
  connections: PlatformConnectionPublic[]
  twitchConfigured: boolean
  connecting: boolean
  onConnectTwitch: () => void
  onDisconnect: (platform: 'twitch' | 'kick') => void
  onTestAlert: () => void
}

export default function IntegrationsPanel({
  connections,
  twitchConfigured,
  connecting,
  onConnectTwitch,
  onDisconnect,
  onTestAlert
}: IntegrationsPanelProps) {
  const twitch = connections.find((c) => c.platform === 'twitch')
  const kick = connections.find((c) => c.platform === 'kick')

  return (
    <div className="integrations-panel">
      <header className="integrations-header">
        <h1>Connexions & Widgets</h1>
        <p>Connectez vos comptes pour récupérer le chat, les alertes et le mini flux en direct.</p>
      </header>

      <a
        href="https://hazeyy5.github.io/nova-stream/"
        target="_blank"
        rel="noreferrer"
        className="web-connect-banner"
      >
        <span className="web-connect-icon">🌐</span>
        <div>
          <strong>Connexion via le site web</strong>
          <p>Connectez-vous sur hazeyy5.github.io/nova-stream puis liez votre compte à cette application.</p>
        </div>
        <span className="web-connect-arrow">→</span>
      </a>

      <div className="platform-cards">
        <PlatformCard
          platform="twitch"
          name="Twitch"
          color="#9146FF"
          gradient="linear-gradient(135deg, #9146FF 0%, #6441a5 100%)"
          connected={!!twitch}
          account={twitch}
          configured={twitchConfigured}
          connecting={connecting}
          onConnect={onConnectTwitch}
          onDisconnect={() => onDisconnect('twitch')}
          features={['Chat Box', 'Alertes follow/sub/raid', 'EventSub temps réel', 'Clé de stream auto']}
        />

        <PlatformCard
          platform="kick"
          name="Kick"
          color="#53FC18"
          gradient="linear-gradient(135deg, #53FC18 0%, #2db814 100%)"
          connected={!!kick}
          account={kick}
          configured={false}
          connecting={false}
          onConnect={() => alert('Connexion Kick — bientôt disponible !')}
          onDisconnect={() => onDisconnect('kick')}
          features={['Chat Box', 'Alertes', 'Mini flux']}
          comingSoon
        />
      </div>

      <section className="widgets-section">
        <h2>Widgets disponibles</h2>
        <div className="widget-cards">
          <div className="widget-card">
            <span className="widget-icon">💬</span>
            <div>
              <strong>Chat Box</strong>
              <p>Affiche le chat Twitch/Kick en overlay sur votre scène. Ajoutez-le via Sources → Chat Box.</p>
            </div>
          </div>
          <div className="widget-card">
            <span className="widget-icon">🔔</span>
            <div>
              <strong>Alert Box</strong>
              <p>Notifications animées pour follows, subs, dons et raids.</p>
              <button className="widget-test-btn" onClick={onTestAlert}>Tester une alerte</button>
            </div>
          </div>
        </div>
      </section>

      {!twitchConfigured && (
        <div className="setup-guide">
          <h3>⚙ Configuration mainteneur requise</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            Les utilisateurs finaux n'ont rien à configurer. En tant que mainteneur du projet :
          </p>
          <ol>
            <li>Créez l'app Twitch officielle « Nova Stream » sur <strong>dev.twitch.tv</strong></li>
            <li>Ajoutez le Client ID dans <code>shared/platform.json</code></li>
            <li>Exécutez <code>npm run sync-config</code> puis redéployez le site</li>
          </ol>
        </div>
      )}
    </div>
  )
}

function PlatformCard({
  name, color, gradient, connected, account, configured, connecting,
  onConnect, onDisconnect, features, comingSoon
}: {
  platform: string
  name: string
  color: string
  gradient: string
  connected: boolean
  account?: PlatformConnectionPublic
  configured: boolean
  connecting: boolean
  onConnect: () => void
  onDisconnect: () => void
  features: string[]
  comingSoon?: boolean
}) {
  return (
    <div className={`platform-card ${connected ? 'connected' : ''}`} style={{ '--brand': color, '--brand-grad': gradient } as React.CSSProperties}>
      <div className="platform-card-header">
        <div className="platform-logo" style={{ background: gradient }}>{name[0]}</div>
        <div>
          <h3>{name}</h3>
          {comingSoon && <span className="badge-soon">Bientôt</span>}
          {connected && account && (
            <span className="badge-connected">● {account.displayName}</span>
          )}
        </div>
      </div>

      <ul className="platform-features">
        {features.map((f) => <li key={f}>✓ {f}</li>)}
      </ul>

      <div className="platform-actions">
        {connected ? (
          <button className="btn-disconnect" onClick={onDisconnect}>Déconnecter</button>
        ) : comingSoon ? (
          <button className="btn-connect disabled" disabled>Bientôt disponible</button>
        ) : (
          <button
            className="btn-connect"
            onClick={onConnect}
            disabled={!configured || connecting}
          >
            {connecting ? 'Connexion...' : `Se connecter avec ${name}`}
          </button>
        )}
      </div>
    </div>
  )
}
