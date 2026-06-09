import { memo, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'
import './ChatPanel.css'

interface ChatPanelProps {
  messages: ChatMessage[]
  canSend: boolean
  chatHint?: string
  onSend: (text: string) => Promise<{ success: boolean; message?: string }>
}

const ChatLine = memo(function ChatLine({ msg }: { msg: ChatMessage }) {
  return (
    <div className="chat-panel-line">
      <span className="chat-panel-user" style={{ color: msg.color ?? '#a78bfa' }}>
        {msg.username}
      </span>
      <span className="chat-panel-text">{msg.message}</span>
    </div>
  )
})

export default function ChatPanel({ messages, canSend, chatHint, onSend }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (messages.length === prevLenRef.current) return
    prevLenRef.current = messages.length
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const submit = async () => {
    const text = draft.trim()
    if (!text || !canSend || sending) return
    setSending(true)
    setError(null)
    try {
      const result = await onSend(text)
      if (result.success) {
        setDraft('')
      } else if (result.message) {
        setError(result.message)
      }
    } catch {
      setError('Erreur inattendue lors de l\'envoi.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="dock-panel chat-panel">
      <div className="dock-panel-header">
        <h3>Chat</h3>
        {messages.length > 0 && (
          <span className="chat-panel-count">{messages.length}</span>
        )}
      </div>
      <div className="chat-panel-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <p className="chat-panel-empty">
            {canSend
              ? 'Le chat est prêt — écrivez un message ci-dessous.'
              : (chatHint ?? 'Connectez Twitch dans Apps pour voir et envoyer des messages.')}
          </p>
        ) : (
          messages.map((msg) => <ChatLine key={msg.id} msg={msg} />)
        )}
      </div>
      <div className="chat-panel-input-wrap">
        {error && <p className="chat-panel-error">{error}</p>}
        <form
          className="chat-panel-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <input
            className="chat-panel-input"
            placeholder={canSend ? 'Envoyer un message…' : 'Chat indisponible…'}
            disabled={!canSend || sending}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="submit"
            className="chat-panel-send-btn"
            disabled={!canSend || sending || !draft.trim()}
          >
            {sending ? '…' : 'Envoyer'}
          </button>
        </form>
      </div>
    </div>
  )
}
