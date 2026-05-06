import algosdk from 'algosdk'
import { DolanPredictionClient } from 'dolanswap-sdk'

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
})

async function main() {
  console.log('Scanning for unclaimed winnings...')
  const unclaimed = await client.getUnclaimedRounds()

  if (unclaimed.length === 0) {
    console.log('No unclaimed winnings found.')
    return
  }

  console.log(`Found ${unclaimed.length} unclaimed round(s):\n`)
  for (const entry of unclaimed) {
    const payoutAlgo = entry.payout / 1e6
    const betAlgo = entry.bet.amount / 1e6
    const dir = entry.bet.direction === 1 ? 'UP' : 'DOWN'
    console.log(`  Round ${entry.roundId} | Bet: ${betAlgo} ALGO ${dir} | Payout: ${payoutAlgo.toFixed(2)} ALGO`)
  }

  const roundIds = unclaimed.map((u) => u.roundId)
  console.log(`\nClaiming ${roundIds.length} round(s)...`)

  const txIds = await client.batchClaim(roundIds)
  console.log(`Claimed! TX IDs:`)
  for (const txId of txIds) {
    console.log(`  ${txId}`)
  }
}

main().catch(console.error)
