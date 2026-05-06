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
  const openRounds = await client.getOpenRounds()
  if (openRounds.length === 0) {
    console.log('No open rounds right now. Try again in a few minutes.')
    return
  }

  const round = openRounds[0]!
  const direction = 1 as const
  const amountMicroAlgo = 1_000_000

  console.log(`Placing 1 ALGO UP bet on round ${round.roundId}...`)
  console.log(`Time until lock: ${client.timeUntilLock(round)}s`)

  const txId = await client.placeBet(round.roundId, direction, amountMicroAlgo)
  console.log(`Bet placed! TX: ${txId}`)
}

main().catch(console.error)
