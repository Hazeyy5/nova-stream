import type { PlatformConnectionPublic, TtsSettings } from '../types'
import './IntegrationsPanel.css'
import TtsPanel from './TtsPanel'

interface IntegrationsPanelProps {
  connections: PlatformConnectionPublic[]
  twitchConfigured: boolean
  connecting?: boolean
  onConnectTwitch: () => void
  onDisconnect: (platform: 'twitch' | 'kick') => void
  onTestAlert: () => void
  ttsSettings?: TtsSettings
  onSaveTts: (partial: Partial<TtsSettings>) => void | Promise<void>
}

export default function IntegrationsPanel({
  connections,
  twitchConfigured,
  connecting = false,
  onConnectTwitch,
  onDisconnect,
  onTestAlert,
  ttsSettings,
  onSaveTts
}: IntegrationsPanelProps) {
  const twitch = connections.find((c) => c.platform === 'twitch')
  const kick = connections.find((c) => c.platform === 'kick')

  return (
    <div className="integrations-panel">
      <header className="integrations-header">
        <h1>Connexions & Widgets</h1>
        <p>Connectez Twitch pour le chat, les alertes EventSub (follow, sub, raid, bits) et la clé stream.</p>
      </header>

      <button type="button" className="web-connect-banner" onClick={onConnectTwitch} disabled={connecting}>
        <span className="web-connect-icon">{connecting ? '⏳' : '🔗'}</span>
        <div>
          <strong>{connecting ? 'Connexion Twitch…' : 'Se connecter avec Twitch'}</strong>
          <p>
            Connexion directe dans l&apos;app (OAuth). Si ça échoue, le site web s&apos;ouvre pour lier via le tableau de bord.
          </p>
        </div>
        <span className="web-connect-arrow">→</span>
      </button>

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
          features={['Chat Box', 'Alertes follow/sub/raid/bits', 'EventSub temps réel', 'TTS points de chaîne', 'Dons PayPal', 'Clé stream auto']}
        />

        <PlatformCard
          platform="kick"
          name="Kick"
          color="#53FC18"
          gradient="linear-gradient(135deg, #53FC18 0%, #2db814 100%)"
          connected={!!kick}
          account={kick}
          configured={false}
          onConnect={() => {}}
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
              <p>Affiche le chat Twitch en overlay sur votre scène. Ajoutez-le via Sources → Chat Box.</p>
            </div>
          </div>
          <div className="widget-card">
            <span className="widget-icon">🔔</span>
            <div>
              <strong>Alert Box</strong>
              <p>Notifications animées pour follows, subs, dons, raids et bits — sons personnalisables.</p>
              <button className="widget-test-btn" onClick={onTestAlert}>Tester une alerte</button>
            </div>
          </div>
        </div>
      </section>

      <TtsPanel
        settings={ttsSettings}
        twitchConnected={!!twitch}
        onSave={onSaveTts}
      />

      {!twitchConfigured && (
        <div className="setup-guide">
          <h3>⚙ Configuration mainteneur requise</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            Les utilisateurs finaux n&apos;ont rien à configurer. En tant que mainteneur du projet :
          </p>
          <ol>
            <li>Créez l&apos;app Twitch officielle « Nova Stream » sur <strong>dev.twitch.tv</strong></li>
            <li>Ajoutez le Client ID dans <code>shared/platform.json</code></li>
            <li>Exécutez <code>npm run sync-config</code> puis redéployez le site</li>
          </ol>
        </div>
      )}
    </div>
  )
}

function PlatformCard({
  name, color, gradient, connected, account, configured,
  onConnect, onDisconnect, features, comingSoon, connecting
}: {
  platform: string
  name: string
  color: string
  gradient: string
  connected: boolean
  account?: PlatformConnectionPublic
  configured: boolean
  onConnect: () => void
  onDisconnect: () => void
  features: string[]
  comingSoon?: boolean
  connecting?: boolean
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
            {connecting ? 'Connexion…' : `Se connecter avec ${name}`}
          </button>
        )}
      </div>
    </div>
  )
}
