import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ChatMessage, FeedEvent, PlatformConnectionPublic, StreamAlert } from '../types'
import { filterActivityEvents } from '../lib/feedEvents'

export function useIntegrations() {
  const [connections, setConnections] = useState<PlatformConnectionPublic[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([])
  const [activeAlerts, setActiveAlerts] = useState<StreamAlert[]>([])
  const [twitchConfigured, setTwitchConfigured] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [chatStatus, setChatStatus] = useState({
    linked: false,
    chatConnected: false,
    canSend: false,
    username: undefined as string | undefined
  })

  const activityEvents = useMemo(() => filterActivityEvents(feedEvents), [feedEvents])

  const refreshChatStatus = useCallback(async () => {
    const status = await window.novaStream.integrations.getChatStatus()
    setChatStatus(status)
  }, [])

  const refresh = useCallback(async () => {
    const [conns, msgs, feed, alerts, configured] = await Promise.all([
      window.novaStream.integrations.getConnections(),
      window.novaStream.integrations.getMessages(),
      window.novaStream.integrations.getFeed(),
      window.novaStream.integrations.getAlerts(),
      window.novaStream.integrations.isTwitchConfigured()
    ])
    setConnections(conns)
    setMessages(msgs)
    setFeedEvents(filterActivityEvents(feed))
    setActiveAlerts(alerts)
    setTwitchConfigured(configured)
    await refreshChatStatus()
  }, [refreshChatStatus])

  useEffect(() => {
    refresh()
    const unsubs = [
      window.novaStream.integrations.onChatMessage((msg) => {
        setMessages((prev) => [...prev.slice(-99), msg])
      }),
      window.novaStream.integrations.onFeedEvent((evt) => {
        if (evt.type === 'chat') return
        setFeedEvents((prev) => filterActivityEvents([evt, ...prev]).slice(0, 50))
      }),
      window.novaStream.integrations.onFeedCleared(() => {
        setFeedEvents([])
      }),
      window.novaStream.integrations.onAlert((alert) => {
        setActiveAlerts((prev) => [...prev, alert])
      }),
      window.novaStream.integrations.onAlertDismiss((id) => {
        setActiveAlerts((prev) => prev.filter((a) => a.id !== id))
      }),
      window.novaStream.integrations.onUpdated((conns) => {
        setConnections(conns)
        void refreshChatStatus()
      })
    ]
    return () => unsubs.forEach((u) => u())
  }, [refresh])

  const connectTwitch = async () => {
    setConnecting(true)
    try {
      const result = await window.novaStream.integrations.connectTwitch()
      if (!result.success) throw new Error(result.message)
      await refresh()
      return result.connection
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async (platform: 'twitch' | 'kick') => {
    await window.novaStream.integrations.disconnect(platform)
    await refresh()
  }

  const testAlert = (type?: StreamAlert['type']) => {
    window.novaStream.integrations.testAlert(type)
  }

  const clearFeed = useCallback(async () => {
    await window.novaStream.integrations.clearFeed()
    setFeedEvents([])
  }, [])

  const sendChatMessage = useCallback(async (text: string) => {
    const result = await window.novaStream.integrations.sendChatMessage(text)
    await refreshChatStatus()
    return result
  }, [refreshChatStatus])

  const isConnected = (platform: 'twitch' | 'kick') =>
    connections.some((c) => c.platform === platform)

  return {
    connections,
    messages,
    feedEvents: activityEvents,
    activeAlerts,
    twitchConfigured,
    connecting,
    connectTwitch,
    disconnect,
    testAlert,
    clearFeed,
    sendChatMessage,
    chatStatus,
    isConnected,
    refresh
  }
}
