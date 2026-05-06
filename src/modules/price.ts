const TICKER_WS_URL = 'wss://ws-feed.exchange.coinbase.com'
const TICKER_REST_URL = 'https://api.exchange.coinbase.com/products/ALGO-USD/ticker'
const SYMBOL = 'ALGO-USD'
const REST_POLL_MS = 3_000
const MAX_BACKOFF_MS = 30_000

export async function getLivePrice(): Promise<number> {
  const res = await fetch(TICKER_REST_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Coinbase REST ${res.status}`)
  const data = await res.json()
  const price = Number(data?.price)
  if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid price from Coinbase')
  return price
}

export function streamPrice(callback: (price: number) => void): () => void {
  let ws: InstanceType<typeof WebSocket> | null = null
  let stopped = false
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let restTimer: ReturnType<typeof setInterval> | null = null

  function setPrice(p: number) {
    if (Number.isFinite(p) && p > 0) callback(p)
  }

  async function fetchRest() {
    try {
      const res = await fetch(TICKER_REST_URL, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setPrice(Number(data?.price))
    } catch {}
  }

  function startRestFallback() {
    if (restTimer) return
    fetchRest()
    restTimer = setInterval(fetchRest, REST_POLL_MS)
  }

  function stopRestFallback() {
    if (restTimer) {
      clearInterval(restTimer)
      restTimer = null
    }
  }

  function connect() {
    if (stopped) return

    let WebSocketImpl: typeof WebSocket
    try {
      WebSocketImpl = typeof WebSocket !== 'undefined'
        ? WebSocket
        : (require('ws') as typeof WebSocket)
    } catch {
      startRestFallback()
      return
    }

    const socket = new WebSocketImpl(TICKER_WS_URL)

    socket.onopen = () => {
      reconnectAttempt = 0
      stopRestFallback()
      socket.send(JSON.stringify({
        type: 'subscribe',
        product_ids: [SYMBOL],
        channels: ['ticker'],
      }))
    }

    socket.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString())
        if (msg.type === 'ticker' && msg.product_id === SYMBOL) {
          setPrice(Number(msg.price))
        }
      } catch {}
    }

    socket.onclose = () => {
      ws = null
      if (!stopped) scheduleReconnect()
    }

    socket.onerror = () => {
      socket.close()
    }

    ws = socket as InstanceType<typeof WebSocket>
  }

  function scheduleReconnect() {
    if (reconnectTimer || stopped) return
    const backoff = Math.min(1000 * 2 ** reconnectAttempt, MAX_BACKOFF_MS)
    reconnectAttempt++
    startRestFallback()
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, backoff)
  }

  function stop() {
    stopped = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    stopRestFallback()
    if (ws) {
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      ws.close()
      ws = null
    }
  }

  connect()
  return stop
}
