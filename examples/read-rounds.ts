import algosdk from 'algosdk'
import { DolanPredictionClient, STATUS_OPEN, STATUS_LOCKED, STATUS_CLOSED, OUTCOME_UP, OUTCOME_DOWN, OUTCOME_DRAW, OUTCOME_INVALID } from 'dolanswap-sdk'

const algod = new algosdk.Algodv2('', 'https://mainnet-api.algonode.cloud', 443)
const client = new DolanPredictionClient({ algodClient: algod })

function statusLabel(s: number): string {
  if (s === STATUS_OPEN) return 'OPEN'
  if (s === STATUS_LOCKED) return 'LOCKED'
  if (s === STATUS_CLOSED) return 'CLOSED'
  return `UNKNOWN(${s})`
}

function outcomeLabel(o: number): string {
  if (o === OUTCOME_UP) return 'UP'
  if (o === OUTCOME_DOWN) return 'DOWN'
  if (o === OUTCOME_DRAW) return 'DRAW'
  if (o === OUTCOME_INVALID) return 'INVALID'
  return 'PENDING'
}

async function main() {
  const currentId = await client.getCurrentRoundId()
  console.log(`Current round: ${currentId}\n`)

  const rounds = await client.getRounds(5)
  for (const round of rounds) {
    const totalPool = (round.upPool + round.downPool) / 1e6
    console.log(
      `Round ${round.roundId} | ${statusLabel(round.status)} | ${outcomeLabel(round.outcome)} | ` +
      `Pool: ${totalPool.toFixed(2)} ALGO | UP: ${(round.upPool / 1e6).toFixed(2)} | DOWN: ${(round.downPool / 1e6).toFixed(2)} | ` +
      `Lock: ${round.lockPrice / 1e8} | Close: ${round.closePrice / 1e8}`
    )
  }

  console.log('')
  const oracle = await client.getOraclePrice()
  console.log(`Oracle price: $${oracle.price.toFixed(4)} (updated ${new Date(oracle.timestamp * 1000).toISOString()})`)

  const live = await client.getLivePrice()
  console.log(`Live price:   $${live.toFixed(4)}`)
  console.log(`Spread:       ${((live - oracle.price) / oracle.price * 100).toFixed(3)}%`)
}

main().catch(console.error)
