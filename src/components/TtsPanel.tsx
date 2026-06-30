import { useCallback, useEffect, useState } from 'react'
import type { TtsSettings } from '../types'
import { testTts, listTtsVoices, initTtsVoices } from '../lib/ttsPlayer'
import { mergeTtsVoiceOptions } from '../lib/ttsVoices'
import './TtsPanel.css'

const DEFAULT_TTS: TtsSettings = {
  enabled: false,
  rewardId: '',
  rewardTitle: '',
  rewardCost: 500,
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

interface TwitchReward {
  id: string
  title: string
  cost: number
  is_user_input_required: boolean
}

interface TtsPanelProps {
  settings: TtsSettings | undefined
  twitchConnected: boolean
  onSave: (partial: TtsSettings) => void | Promise<void>
}

export default function TtsPanel({ settings, twitchConnected, onSave }: TtsPanelProps) {
  const [form, setForm] = useState<TtsSettings>({ ...DEFAULT_TTS, ...settings })
  const [voiceOptions, setVoiceOptions] = useState<{ name: string; label: string }[]>([])
  const [blockedInput, setBlockedInput] = useState((settings?.blockedWords ?? []).join(', '))
  const [rewards, setRewards] = useState<TwitchReward[]>([])
  const [rewardsLoading, setRewardsLoading] = useState(false)
  const [rewardMsg, setRewardMsg] = useState('')
  const [newTitle, setNewTitle] = useState('Lire mon message')
  const [newCost, setNewCost] = useState(500)
  const [newPrompt, setNewPrompt] = useState('Votre message TTS')

  const refreshVoices = useCallback(() => {
    const merged = mergeTtsVoiceOptions(listTtsVoices())
    setVoiceOptions(merged.map((v) => ({ name: v.name, label: v.label })))
  }, [])

  const loadRewards = useCallback(async () => {
    if (!twitchConnected || !window.novaStream.integrations.listCustomRewards) return
    setRewardsLoading(true)
    setRewardMsg('')
    try {
      const list = await window.novaStream.integrations.listCustomRewards()
      setRewards(list.filter((r) => r.is_user_input_required))
    } catch (err) {
      setRewardMsg(err instanceof Error ? err.message : 'Impossible de charger les récompenses')
    } finally {
      setRewardsLoading(false)
    }
  }, [twitchConnected])

  useEffect(() => {
    initTtsVoices()
    refreshVoices()
    window.speechSynthesis.onvoiceschanged = refreshVoices
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [refreshVoices])

  useEffect(() => {
    setForm({ ...DEFAULT_TTS, ...settings })
    setBlockedInput((settings?.blockedWords ?? []).join(', '))
  }, [settings])

  useEffect(() => {
    void loadRewards()
  }, [loadRewards])

  const update = (partial: Partial<TtsSettings>) => {
    const next = { ...form, ...partial }
    setForm(next)
    void onSave(next)
  }

  const selectReward = (rewardId: string) => {
    const reward = rewards.find((r) => r.id === rewardId)
    update({
      rewardId,
      rewardTitle: reward?.title ?? '',
      rewardCost: reward?.cost
    })
  }

  const updateRewardCost = async () => {
    if (!form.rewardId || !window.novaStream.integrations.updateCustomReward) return
    setRewardMsg('')
    try {
      await window.novaStream.integrations.updateCustomReward(form.rewardId, { cost: form.rewardCost ?? 500 })
      setRewardMsg(`Coût mis à jour : ${form.rewardCost} points`)
      await loadRewards()
    } catch (err) {
      setRewardMsg(err instanceof Error ? err.message : 'Mise à jour échouée')
    }
  }

  const createReward = async () => {
    if (!window.novaStream.integrations.createTtsReward) return
    setRewardMsg('')
    try {
      const reward = await window.novaStream.integrations.createTtsReward({
        title: newTitle,
        cost: newCost,
        prompt: newPrompt
      })
      setRewardMsg(`Récompense « ${reward.title} » créée`)
      await loadRewards()
      update({ rewardId: reward.id, rewardTitle: reward.title, rewardCost: reward.cost })
    } catch (err) {
      setRewardMsg(err instanceof Error ? err.message : 'Création échouée')
    }
  }

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
        <p className="tts-hint warn">Connectez Twitch pour activer le TTS (scopes points de chaîne requis).</p>
      )}

      <div className="tts-reward-block">
        <div className="tts-reward-head">
          <strong>Récompense points de chaîne</strong>
          <button type="button" className="tts-link-btn" disabled={rewardsLoading} onClick={() => void loadRewards()}>
            {rewardsLoading ? '…' : '↻ Actualiser'}
          </button>
        </div>
        <label className="tts-field">
          Récompense TTS
          <select
            value={form.rewardId ?? ''}
            disabled={!twitchConnected}
            onChange={(e) => selectReward(e.target.value)}
          >
            <option value="">— Choisir —</option>
            {rewards.map((r) => (
              <option key={r.id} value={r.id}>{r.title} ({r.cost} pts)</option>
            ))}
          </select>
        </label>
        <label className="tts-field tts-cost-field">
          Coût (points)
          <div className="tts-cost-row">
            <input
              type="number"
              min={1}
              max={999999}
              value={form.rewardCost ?? 500}
              disabled={!form.rewardId}
              onChange={(e) => update({ rewardCost: Number(e.target.value) })}
            />
            <button type="button" className="tts-test-btn" disabled={!form.rewardId} onClick={() => void updateRewardCost()}>
              Mettre à jour Twitch
            </button>
          </div>
        </label>
        <div className="tts-create-inline">
          <p className="tts-hint">Créer une récompense</p>
          <div className="tts-grid">
            <label className="tts-field">
              Titre
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </label>
            <label className="tts-field">
              Coût (pts)
              <input type="number" min={1} value={newCost} onChange={(e) => setNewCost(Number(e.target.value))} />
            </label>
          </div>
          <label className="tts-field full">
            Invite viewer
            <input value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} />
          </label>
          <button type="button" className="tts-test-btn" disabled={!twitchConnected} onClick={() => void createReward()}>
            + Créer sur Twitch
          </button>
        </div>
        {rewardMsg && <p className="tts-hint">{rewardMsg}</p>}
      </div>

      <div className="tts-grid">
        <label className="tts-field">
          Voix (Windows)
          <select
            value={form.voiceName ?? ''}
            onChange={(e) => update({ voiceName: e.target.value })}
          >
            <option value="">Voix française par défaut</option>
            {voiceOptions.map((v) => (
              <option key={v.name || 'default'} value={v.name}>{v.label}</option>
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
    </section>
  )
}
