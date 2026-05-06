import algosdk from 'algosdk'
import { DolanPredictionClient, MIN_BET_MICROALGO } from 'dolanswap-sdk'
import type { Round } from 'dolanswap-sdk'

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
})

let latestLivePrice = 0

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

client.on('priceUpdate', (price) => {
  latestLivePrice = price
})

client.on('roundOpened', async (round: Round) => {
  log(`Round ${round.roundId} opened | Lock in ${client.timeUntilLock(round)}s`)

  if (latestLivePrice <= 0) {
    log('No live price yet, skipping')
    return
  }

  try {
    const oracle = await client.getOraclePrice()
    const spread = latestLivePrice - oracle.price
    const direction = spread > 0 ? 1 : 2
    const dirLabel = direction === 1 ? 'UP' : 'DOWN'

    log(`Live: $${latestLivePrice.toFixed(4)} | Oracle: $${oracle.price.toFixed(4)} | Spread: ${spread >= 0 ? '+' : ''}${spread.toFixed(4)} → ${dirLabel}`)

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

log('Starting bot...')
client.startPolling()

process.on('SIGINT', () => {
  log('Shutting down...')
  client.stopPolling()
  process.exit(0)
})
