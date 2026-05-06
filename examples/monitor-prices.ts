import algosdk from 'algosdk'
import { DolanPredictionClient } from 'dolanswap-sdk'

const algod = new algosdk.Algodv2('', 'https://mainnet-api.algonode.cloud', 443)
const client = new DolanPredictionClient({ algodClient: algod })

async function main() {
  const oracle = await client.getOraclePrice()
  console.log(`Oracle price: $${oracle.price.toFixed(4)} (updated ${new Date(oracle.timestamp * 1000).toISOString()})`)
  console.log('Streaming live Coinbase ALGO/USD...\n')

  const unsub = client.streamPrice((livePrice) => {
    const spread = livePrice - oracle.price
    const spreadPct = (spread / oracle.price) * 100
    const arrow = spread > 0 ? '▲' : spread < 0 ? '▼' : '—'
    console.log(
      `Live: $${livePrice.toFixed(4)} | Oracle: $${oracle.price.toFixed(4)} | ` +
      `Spread: ${spread >= 0 ? '+' : ''}${spread.toFixed(4)} (${spreadPct >= 0 ? '+' : ''}${spreadPct.toFixed(3)}%) ${arrow}`
    )
  })

  process.on('SIGINT', () => {
    console.log('\nStopping...')
    unsub()
    process.exit(0)
  })
}

main().catch(console.error)
