import algosdk from 'algosdk'
import type { UnclaimedRound } from '../types.js'
import type { RateLimiter } from '../utils/rate-limiter.js'
import {
  PREDICTION_APP_ID,
  OUTCOME_PENDING,
  OUTCOME_UP,
  OUTCOME_DOWN,
  OUTCOME_DRAW,
  OUTCOME_INVALID,
  STATUS_CLOSED,
} from '../constants.js'
import { encodeRoundBoxName, encodeBetBoxName } from '../utils/encoding.js'
import { calculatePayout } from '../utils/payout.js'
import { getBet, getBetHistory } from './betting.js'
import { getRound } from './rounds.js'

const CLAIM_WINNINGS = new algosdk.ABIMethod({
  name: 'claim_winnings',
  args: [{ type: 'uint64', name: 'round_id' }],
  returns: { type: 'void' },
})

const BATCH_CLAIM = new algosdk.ABIMethod({
  name: 'batch_claim',
  args: [{ type: 'uint64[]', name: 'round_ids' }],
  returns: { type: 'void' },
})

export async function getUnclaimedRounds(
  rateLimiter: RateLimiter,
  algod: algosdk.Algodv2,
  address: string,
  appId: number = PREDICTION_APP_ID,
): Promise<UnclaimedRound[]> {
  const roundIds = await getBetHistory(rateLimiter, address, appId)
  const unclaimed: UnclaimedRound[] = []

  for (const roundId of roundIds) {
    const round = await getRound(rateLimiter, roundId, appId)
    if (!round || round.status !== STATUS_CLOSED) continue
    if (round.outcome === OUTCOME_PENDING) continue

    const bet = await getBet(rateLimiter, roundId, address, appId)
    if (!bet || bet.claimed) continue

    const isWinner =
      (round.outcome === OUTCOME_UP && bet.direction === 1) ||
      (round.outcome === OUTCOME_DOWN && bet.direction === 2)
    const isRefund = round.outcome === OUTCOME_DRAW || round.outcome === OUTCOME_INVALID

    if (!isWinner && !isRefund) continue

    const payout = calculatePayout(bet.amount, bet.direction, round)
    unclaimed.push({ roundId, bet, payout })
  }

  return unclaimed
}

export async function claimWinnings(
  algod: algosdk.Algodv2,
  signer: algosdk.TransactionSigner,
  sender: string,
  roundId: number,
  appId: number = PREDICTION_APP_ID,
): Promise<string> {
  const sp = await algod.getTransactionParams().do()
  sp.flatFee = true
  sp.fee = BigInt(2000)

  const roundKey = encodeRoundBoxName(roundId)
  const betKey = encodeBetBoxName(roundId, sender)

  const atc = new algosdk.AtomicTransactionComposer()
  atc.addMethodCall({
    appID: appId,
    method: CLAIM_WINNINGS,
    methodArgs: [BigInt(roundId)],
    sender,
    signer,
    suggestedParams: sp,
    boxes: [
      { appIndex: appId, name: roundKey },
      { appIndex: appId, name: betKey },
    ],
  })

  const result = await atc.execute(algod, 4)
  return result.txIDs[0]!
}

export async function batchClaim(
  algod: algosdk.Algodv2,
  signer: algosdk.TransactionSigner,
  sender: string,
  roundIds: number[],
  appId: number = PREDICTION_APP_ID,
): Promise<string[]> {
  if (roundIds.length === 0) return []

  const chunks: number[][] = []
  for (let i = 0; i < roundIds.length; i += 4) {
    chunks.push(roundIds.slice(i, i + 4))
  }

  const MAX_TXN_PER_GROUP = 16
  const allTxIds: string[] = []

  for (let b = 0; b < chunks.length; b += MAX_TXN_PER_GROUP) {
    const batchChunks = chunks.slice(b, b + MAX_TXN_PER_GROUP)
    const atc = new algosdk.AtomicTransactionComposer()
    const baseSp = await algod.getTransactionParams().do()

    for (const chunk of batchChunks) {
      const sp = { ...baseSp }
      sp.flatFee = true
      sp.fee = BigInt(1000 + 1000 * chunk.length)

      const boxes: { appIndex: number; name: Uint8Array }[] = []
      for (const rid of chunk) {
        boxes.push({ appIndex: appId, name: encodeRoundBoxName(rid) })
        boxes.push({ appIndex: appId, name: encodeBetBoxName(rid, sender) })
      }

      atc.addMethodCall({
        appID: appId,
        method: BATCH_CLAIM,
        methodArgs: [chunk.map((id) => BigInt(id))],
        sender,
        signer,
        suggestedParams: sp,
        boxes,
      })
    }

    const result = await atc.execute(algod, 4)
    allTxIds.push(...result.txIDs)
  }

  return allTxIds
}
