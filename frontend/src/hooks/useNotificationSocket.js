import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/auth'

export function useNotificationSocket() {
  const token = useAuthStore(s => s.token)
  const qc = useQueryClient()
  const ws = useRef(null)

  useEffect(() => {
    if (!token) return

    const wsBase = import.meta.env.VITE_WS_URL || 'ws://localhost/ws'
    const url = `${wsBase}/notifications?token=${encodeURIComponent(token)}`

    const connect = () => {
      ws.current = new WebSocket(url)

      ws.current.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          toast(msg.title, { icon: '🔔' })
          qc.invalidateQueries({ queryKey: ['notifications'] })
          qc.invalidateQueries({ queryKey: ['trades'] })
        } catch {}
      }

      ws.current.onclose = () => {
        // Reconnect after 3s
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => ws.current?.close()
  }, [token])
}
