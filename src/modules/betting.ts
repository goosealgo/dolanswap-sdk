import algosdk from 'algosdk'
import type { Bet, BetDirection } from '../types.js'
import type { RateLimiter } from '../utils/rate-limiter.js'
import {
  PREDICTION_APP_ID,
  ALGOD_URL,
  INDEXER_URL,
  MIN_BET_MICROALGO,
  MAX_BET_MICROALGO,
  BOX_PREFIX_ROUND,
} from '../constants.js'
import { encodeRoundBoxName, encodeBetBoxName, parseBetBox, decodeAlgorandAddress } from '../utils/encoding.js'

const PLACE_BET = new algosdk.ABIMethod({
  name: 'place_bet',
  args: [
    { type: 'uint64', name: 'round_id' },
    { type: 'uint8', name: 'direction' },
  ],
  returns: { type: 'void' },
})

export async function placeBet(
  algod: algosdk.Algodv2,
  signer: algosdk.TransactionSigner,
  sender: string,
  roundId: number,
  direction: BetDirection,
  amountMicroAlgo: number,
  appId: number = PREDICTION_APP_ID,
): Promise<string> {
  if (amountMicroAlgo < MIN_BET_MICROALGO) {
    throw new Error(`Bet amount ${amountMicroAlgo} below minimum ${MIN_BET_MICROALGO}`)
  }
  if (amountMicroAlgo > MAX_BET_MICROALGO) {
    throw new Error(`Bet amount ${amountMicroAlgo} above maximum ${MAX_BET_MICROALGO}`)
  }

  const sp = await algod.getTransactionParams().do()
  const appAddr = algosdk.getApplicationAddress(appId).toString()

  const payment = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: appAddr,
    amount: amountMicroAlgo,
    suggestedParams: sp,
  })

  const roundKey = encodeRoundBoxName(roundId)
  const betKey = encodeBetBoxName(roundId, sender)

  const atc = new algosdk.AtomicTransactionComposer()
  atc.addTransaction({ txn: payment, signer })
  atc.addMethodCall({
    appID: appId,
    method: PLACE_BET,
    methodArgs: [BigInt(roundId), direction],
    sender,
    signer,
    suggestedParams: sp,
    boxes: [
      { appIndex: appId, name: roundKey },
      { appIndex: appId, name: betKey },
    ],
  })

  const result = await atc.execute(algod, 4)
  return result.txIDs[result.txIDs.length - 1]!
}

export async function getBet(
  rateLimiter: RateLimiter,
  roundId: number,
  address: string,
  appId: number = PREDICTION_APP_ID,
): Promise<Bet | null> {
  await rateLimiter.acquire()
  const key = encodeBetBoxName(roundId, address)
  const nameB64 = Buffer.from(key).toString('base64')
  const url = `${ALGOD_URL}/v2/applications/${appId}/box?name=b64:${encodeURIComponent(nameB64)}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const bytes = new Uint8Array(Buffer.from(data.value, 'base64'))
    return parseBetBox(bytes) as Bet
  } catch {
    return null
  }
}

export async function getBetHistory(
  rateLimiter: RateLimiter,
  address: string,
  appId: number = PREDICTION_APP_ID,
): Promise<number[]> {
  await rateLimiter.acquire()
  const roundIds = new Set<number>()
  try {
    let nextToken: string | undefined
    do {
      const url = new URL(`${INDEXER_URL}/v2/accounts/${address}/transactions`)
      url.searchParams.set('application-id', String(appId))
      url.searchParams.set('limit', '1000')
      if (nextToken) url.searchParams.set('next', nextToken)

      const res = await fetch(url.toString())
      if (!res.ok) break

      const data = await res.json()
      for (const txn of data.transactions ?? []) {
        const appCall = txn['application-transaction']
        if (!appCall) continue
        for (const box of appCall['boxes'] ?? []) {
          const name: string | undefined = box.name
          if (!name) continue
          const bytes = new Uint8Array(Buffer.from(name, 'base64'))
          if (bytes.length === 9 && bytes[0] === BOX_PREFIX_ROUND) {
            const view = new DataView(bytes.buffer, bytes.byteOffset)
            roundIds.add(Number(view.getBigUint64(1)))
          }
        }
      }
      nextToken = data['next-token']
    } while (nextToken)
  } catch {
    return []
  }
  return Array.from(roundIds).sort((a, b) => a - b)
}
