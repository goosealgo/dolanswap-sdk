import type algosdk from 'algosdk'
import type { Round } from '../types.js'
import type { RateLimiter } from '../utils/rate-limiter.js'
import { PREDICTION_APP_ID, ALGOD_URL } from '../constants.js'
import { encodeRoundBoxName, parseRoundBox } from '../utils/encoding.js'
import { isOpen, isLocked } from '../utils/time.js'

function decodeStateKey(key: Uint8Array | string): string {
  if (key instanceof Uint8Array) return Buffer.from(key).toString('utf-8')
  return Buffer.from(key as string, 'base64').toString('utf-8')
}

export async function getCurrentRoundId(
  algod: algosdk.Algodv2,
  rateLimiter: RateLimiter,
  appId: number = PREDICTION_APP_ID,
): Promise<number> {
  await rateLimiter.acquire()
  const info = await algod.getApplicationByID(appId).do()
  const gs = info.params.globalState as Array<{
    key: Uint8Array | string
    value: { type: number; uint?: number | bigint }
  }>
  for (const entry of gs) {
    if (decodeStateKey(entry.key) === 'current_round') {
      return Number(entry.value.uint ?? 0)
    }
  }
  return 0
}

export async function getRound(
  rateLimiter: RateLimiter,
  roundId: number,
  appId: number = PREDICTION_APP_ID,
): Promise<Round | null> {
  await rateLimiter.acquire()
  const key = encodeRoundBoxName(roundId)
  const nameB64 = Buffer.from(key).toString('base64')
  const url = `${ALGOD_URL}/v2/applications/${appId}/box?name=b64:${encodeURIComponent(nameB64)}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const bytes = new Uint8Array(Buffer.from(data.value, 'base64'))
    return parseRoundBox(bytes, roundId) as Round
  } catch {
    return null
  }
}

export async function getRounds(
  rateLimiter: RateLimiter,
  algod: algosdk.Algodv2,
  count: number = 10,
  appId: number = PREDICTION_APP_ID,
): Promise<Round[]> {
  const currentId = await getCurrentRoundId(algod, rateLimiter, appId)
  if (currentId === 0) return []
  const start = Math.max(1, currentId - count + 1)
  const promises: Promise<Round | null>[] = []
  for (let i = start; i <= currentId; i++) {
    promises.push(getRound(rateLimiter, i, appId))
  }
  const results = await Promise.all(promises)
  return results.filter((r): r is Round => r !== null)
}

export async function getOpenRounds(
  rateLimiter: RateLimiter,
  algod: algosdk.Algodv2,
  appId: number = PREDICTION_APP_ID,
): Promise<Round[]> {
  const currentId = await getCurrentRoundId(algod, rateLimiter, appId)
  if (currentId === 0) return []
  const rounds: Round[] = []
  for (let i = currentId; i >= Math.max(1, currentId - 2); i--) {
    const round = await getRound(rateLimiter, i, appId)
    if (round && isOpen(round)) rounds.push(round)
  }
  return rounds
}

export async function getLiveRound(
  rateLimiter: RateLimiter,
  algod: algosdk.Algodv2,
  appId: number = PREDICTION_APP_ID,
): Promise<Round | null> {
  const currentId = await getCurrentRoundId(algod, rateLimiter, appId)
  if (currentId === 0) return null
  for (let i = currentId; i >= Math.max(1, currentId - 2); i--) {
    const round = await getRound(rateLimiter, i, appId)
    if (round && isLocked(round)) return round
  }
  return null
}
