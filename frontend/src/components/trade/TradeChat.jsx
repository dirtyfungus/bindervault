// frontend/src/components/trade/TradeChat.jsx
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { formatDistanceToNow } from 'date-fns'

export default function TradeChat({ offerId, wsRef }) {
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  const { data: messages = [] } = useQuery({
    queryKey: ['trade-messages', offerId],
    queryFn: () => api.get(`/trades/${offerId}/messages`).then(r => r.data),
    refetchInterval: 2000, // poll every 2s for near-instant feel
  })

  // Listen for real-time messages via websocket notification channel
  useEffect(() => {
    if (!wsRef?.current) return
    const ws = wsRef.current
    const handler = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'trade_message' && data.offer_id === Number(offerId)) {
          qc.invalidateQueries({ queryKey: ['trade-messages', offerId] })
        }
      } catch {}
    }
    ws.addEventListener('message', handler)
    return () => ws.removeEventListener('message', handler)
  }, [wsRef, offerId, qc])

  // Auto scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMutation = useMutation({
    mutationFn: (body) => api.post(`/trades/${offerId}/messages`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trade-messages', offerId] })
      setInput('')
    },
  })

  const handleSend = () => {
    if (!input.trim()) return
    sendMutation.mutate(input.trim())
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={container}>
      <h2 style={title}>Trade chat</h2>

      <div style={messageList}>
        {messages.length === 0 && (
          <div style={empty}>No messages yet. Start the conversation.</div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === me?.id
          return (
            <div key={msg.id} style={{ ...bubbleWrap, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              {!isMe && (
                <div style={{ fontSize: 10, color: 'var(--grey)', marginBottom: 2 }}>
                  {msg.sender_handle}
                </div>
              )}
              <div style={{
                ...bubbleInner,
                background: isMe ? 'var(--teal)' : 'var(--navy)',
                color: isMe ? 'var(--navy)' : 'var(--white-dim)',
              }}>
                {msg.body}
              </div>
              <div style={{ fontSize: 10, color: 'var(--grey)', marginTop: 2 }}>
                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div style={inputRow}>
        <input
          style={inputStyle}
          className="input"
          placeholder="Type a message… (Enter to send)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={sendMutation.isPending}
        />
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={!input.trim() || sendMutation.isPending}
          style={{ flexShrink: 0 }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}

const container = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  height: 420,
}
const title = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--white)',
  margin: 0,
  flexShrink: 0,
}
const messageList = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '4px 0',
}
const empty = {
  fontSize: 13,
  color: 'var(--grey)',
  textAlign: 'center',
  marginTop: 40,
}
const bubbleWrap = {
  display: 'flex',
  flexDirection: 'column',
  maxWidth: '75%',
}
const bubbleInner = {
  fontSize: 13,
  padding: '8px 12px',
  borderRadius: 12,
  lineHeight: 1.5,
  wordBreak: 'break-word',
}
const inputRow = {
  display: 'flex',
  gap: 8,
  flexShrink: 0,
}
const inputStyle = {
  flex: 1,
}