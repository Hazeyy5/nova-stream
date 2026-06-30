import { useEffect, useState } from 'react'
import type { TtsSettings } from '../types'
import { testTts, listTtsVoices, initTtsVoices } from '../lib/ttsPlayer'
import './TtsPanel.css'

const DEFAULT_TTS: TtsSettings = {
  enabled: false,
  rewardId: '',
  rewardTitle: '',
  voiceName: '',
  rate: 1,
  pitch: 1,
  volume: 85,
  maxLength: 200,
  cooldownSec: 15,
  prefixTemplate: '{name} dit : {message}',
  blockedWords: [],
  requireLive: false
}

interface TtsPanelProps {
  settings: TtsSettings | undefined
  twitchConnected: boolean
  onSave: (partial: TtsSettings) => void | Promise<void>
}

export default function TtsPanel({ settings, twitchConnected, onSave }: TtsPanelProps) {
  const [form, setForm] = useState<TtsSettings>({ ...DEFAULT_TTS, ...settings })
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [blockedInput, setBlockedInput] = useState((settings?.blockedWords ?? []).join(', '))

  useEffect(() => {
    initTtsVoices()
    const refresh = () => setVoices(listTtsVoices())
    refresh()
    window.speechSynthesis.onvoiceschanged = refresh
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  useEffect(() => {
    setForm({ ...DEFAULT_TTS, ...settings })
    setBlockedInput((settings?.blockedWords ?? []).join(', '))
  }, [settings])

  const update = (partial: Partial<TtsSettings>) => {
    const next = { ...form, ...partial }
    setForm(next)
    void onSave(next)
  }

  const frVoices = voices.filter((v) => v.lang.startsWith('fr'))

  return (
    <section className="tts-panel">
      <header className="tts-panel-header">
        <h2>🔊 Text-to-Speech (points de chaîne)</h2>
        <p>
          Les viewers dépensent des points de chaîne avec un message — Nova Stream le lit à voix haute.
          Activez la capture <strong>audio bureau</strong> pour l&apos;envoyer sur le stream.
        </p>
      </header>

      <label className="tts-toggle">
        <input
          type="checkbox"
          checked={form.enabled === true}
          disabled={!twitchConnected}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
        <span>Activer le TTS via points de chaîne</span>
      </label>

      {!twitchConnected && (
        <p className="tts-hint warn">Connectez Twitch pour activer le TTS (scope points de chaîne requis).</p>
      )}

      <div className="tts-grid">
        <label className="tts-field">
          ID récompense Twitch (optionnel)
          <input
            type="text"
            value={form.rewardId ?? ''}
            placeholder="Vide = toute récompense avec message"
            onChange={(e) => update({ rewardId: e.target.value.trim() })}
          />
        </label>
        <label className="tts-field">
          Nom de la récompense (info)
          <input
            type="text"
            value={form.rewardTitle ?? ''}
            placeholder="Ex. Lire mon message"
            onChange={(e) => update({ rewardTitle: e.target.value.trim() })}
          />
        </label>
        <label className="tts-field">
          Voix
          <select
            value={form.voiceName ?? ''}
            onChange={(e) => update({ voiceName: e.target.value })}
          >
            <option value="">Voix française par défaut</option>
            {(frVoices.length ? frVoices : voices).map((v) => (
              <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
            ))}
          </select>
        </label>
        <label className="tts-field">
          Modèle : <code>{'{name}'}</code>, <code>{'{message}'}</code>
          <input
            type="text"
            value={form.prefixTemplate ?? DEFAULT_TTS.prefixTemplate}
            onChange={(e) => update({ prefixTemplate: e.target.value })}
          />
        </label>
        <label className="tts-field">
          Vitesse ({form.rate ?? 1})
          <input
            type="range"
            min={0.5}
            max={1.8}
            step={0.1}
            value={form.rate ?? 1}
            onChange={(e) => update({ rate: Number(e.target.value) })}
          />
        </label>
        <label className="tts-field">
          Volume ({form.volume ?? 85}%)
          <input
            type="range"
            min={10}
            max={100}
            value={form.volume ?? 85}
            onChange={(e) => update({ volume: Number(e.target.value) })}
          />
        </label>
        <label className="tts-field">
          Longueur max (car.)
          <input
            type="number"
            min={20}
            max={280}
            value={form.maxLength ?? 200}
            onChange={(e) => update({ maxLength: Number(e.target.value) })}
          />
        </label>
        <label className="tts-field">
          Cooldown par viewer (sec.)
          <input
            type="number"
            min={0}
            max={120}
            value={form.cooldownSec ?? 15}
            onChange={(e) => update({ cooldownSec: Number(e.target.value) })}
          />
        </label>
      </div>

      <label className="tts-field full">
        Mots bloqués (séparés par des virgules)
        <input
          type="text"
          value={blockedInput}
          onChange={(e) => setBlockedInput(e.target.value)}
          onBlur={() => update({
            blockedWords: blockedInput.split(',').map((w) => w.trim()).filter(Boolean)
          })}
        />
      </label>

      <label className="tts-toggle">
        <input
          type="checkbox"
          checked={form.requireLive === true}
          onChange={(e) => update({ requireLive: e.target.checked })}
        />
        <span>Uniquement pendant le live (stream actif)</span>
      </label>

      <div className="tts-actions">
        <button
          type="button"
          className="tts-test-btn"
          onClick={() => testTts({
            voiceName: form.voiceName,
            rate: form.rate,
            pitch: form.pitch,
            volume: form.volume
          })}
        >
          Tester la voix
        </button>
      </div>

      <p className="tts-hint">
        Créez une récompense Twitch avec « Demander au spectateur de saisir du texte » activé.
        Reconnectez Twitch après la mise à jour pour obtenir le scope points de chaîne.
      </p>
    </section>
  )
}
