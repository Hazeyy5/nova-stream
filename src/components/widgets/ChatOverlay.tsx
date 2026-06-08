import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../types'
import './ChatOverlay.css'

interface ChatOverlayProps {
  messages: ChatMessage[]
}

export default function ChatOverlay({ messages }: ChatOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const display = messages.slice(-8)

  return (
    <div className="chat-overlay">
      <div className="chat-overlay-header">
        <span className="chat-live-dot" />
        CHAT EN DIRECT
      </div>
      <div className="chat-messages" ref={scrollRef}>
        {display.length === 0 ? (
          <div className="chat-empty">En attente de messages...</div>
        ) : (
          display.map((msg) => (
            <div key={msg.id} className="chat-line">
              <span className="chat-user" style={{ color: msg.color ?? '#a970ff' }}>
                {msg.username}
              </span>
              <span className="chat-text">{msg.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
