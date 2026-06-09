import { memo, useEffect, useRef } from 'react'
import type { ChatMessage } from '../types'
import './ChatPanel.css'

interface ChatPanelProps {
  messages: ChatMessage[]
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

export default function ChatPanel({ messages }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)

  useEffect(() => {
    if (messages.length === prevLenRef.current) return
    prevLenRef.current = messages.length
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

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
          <p className="chat-panel-empty">Connectez Twitch ou Kick dans Apps pour voir le chat.</p>
        ) : (
          messages.map((msg) => <ChatLine key={msg.id} msg={msg} />)
        )}
      </div>
      <div className="chat-panel-input-wrap">
        <input className="chat-panel-input" placeholder="Envoyer un message…" disabled />
      </div>
    </div>
  )
}
