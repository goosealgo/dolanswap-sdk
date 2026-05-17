import algosdk from 'algosdk'
import { DolanPredictionClient, MIN_BET_MICROALGO } from 'dolanswap-sdk'
import type { Round } from 'dolanswap-sdk'

const BTC_PREDICTION_APP_ID = 3556490128
const BTC_ORACLE_APP_ID = 3556487988
const BTC_REST_URL = 'https://api.exchange.coinbase.com/products/BTC-USD/ticker'

const mnemonic = process.env.MNEMONIC
if (!mnemonic) {
  console.error('Set MNEMONIC environment variable')
  process.exit(1)
}

const account = algosdk.mnemonicToSecretKey(mnemonic)
const algod = new algosdk.Algodv2('', 'https://mainnet-api.algonode.cloud', 443)
const signer = algosdk.makeBasicAccountTransactionSigner(account)

const client = new DolanPredictionClient({
  algodClient: algod,
  signer,
  activeAddress: account.addr.toString(),
  pollIntervalMs: 5000,
  predictionAppId: BTC_PREDICTION_APP_ID,
  oracleAppId: BTC_ORACLE_APP_ID,
})

let latestBtcPrice = 0

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

async function fetchBtcPrice(): Promise<number> {
  const res = await fetch(BTC_REST_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Coinbase REST ${res.status}`)
  const data = await res.json()
  const price = Number(data?.price)
  if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid BTC price')
  return price
}

setInterval(async () => {
  try { latestBtcPrice = await fetchBtcPrice() } catch {}
}, 3000)
fetchBtcPrice().then((p) => { latestBtcPrice = p }).catch(() => {})

client.on('roundOpened', async (round: Round) => {
  log(`Round ${round.roundId} opened | Lock in ${client.timeUntilLock(round)}s`)

  if (latestBtcPrice <= 0) {
    log('No BTC price yet, skipping')
    return
  }

  try {
    const oracle = await client.getOraclePrice()
    const spread = latestBtcPrice - oracle.price
    const direction = spread > 0 ? 1 : 2
    const dirLabel = direction === 1 ? 'UP' : 'DOWN'

    log(`Live: $${latestBtcPrice.toFixed(2)} | Oracle: $${oracle.price.toFixed(2)} | Spread: ${spread >= 0 ? '+' : ''}${spread.toFixed(2)} → ${dirLabel}`)

    const txId = await client.placeBet(round.roundId, direction, MIN_BET_MICROALGO)
    log(`Bet 1 ALGO ${dirLabel} on round ${round.roundId} | TX: ${txId}`)
  } catch (err) {
    log(`Failed to bet: ${err}`)
  }
})

client.on('roundSettled', async (round: Round) => {
  log(`Round ${round.roundId} settled | Outcome: ${round.outcome === 1 ? 'UP' : round.outcome === 2 ? 'DOWN' : round.outcome === 3 ? 'DRAW' : 'INVALID'}`)

  try {
    const bet = await client.getBet(round.roundId)
    if (!bet || bet.claimed) return

    const payout = client.calculatePayout(bet.amount, bet.direction, round)
    if (payout <= 0) {
      log(`Round ${round.roundId}: lost`)
      return
    }

    log(`Round ${round.roundId}: won ${(payout / 1e6).toFixed(2)} ALGO, claiming...`)
    const txId = await client.claimWinnings(round.roundId)
    log(`Claimed round ${round.roundId} | TX: ${txId}`)
  } catch (err) {
    log(`Failed to claim round ${round.roundId}: ${err}`)
  }
})

log('Starting BTC bot...')
client.startPolling()

process.on('SIGINT', () => {
  log('Shutting down...')
  client.stopPolling()
  process.exit(0)
})
