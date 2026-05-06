import type algosdk from 'algosdk'
import type { OracleReading } from '../types.js'
import type { RateLimiter } from '../utils/rate-limiter.js'
import { ORACLE_APP_ID, ORACLE_PRICE_SCALE } from '../constants.js'

function decodeStateKey(key: Uint8Array | string): string {
  if (key instanceof Uint8Array) return Buffer.from(key).toString('utf-8')
  return Buffer.from(key as string, 'base64').toString('utf-8')
}

export async function getOraclePrice(
  algod: algosdk.Algodv2,
  rateLimiter: RateLimiter,
  appId: number = ORACLE_APP_ID,
): Promise<OracleReading> {
  await rateLimiter.acquire()
  const info = await algod.getApplicationByID(appId).do()
  const gs = info.params.globalState as Array<{
    key: Uint8Array | string
    value: { type: number; uint?: number | bigint; bytes?: string }
  }>

  const map = new Map<string, { uint?: number | bigint }>()
  for (const entry of gs) {
    map.set(decodeStateKey(entry.key), entry.value)
  }

  const priceScaled = BigInt(map.get('price')?.uint ?? 0)
  const timestamp = Number(map.get('ts')?.uint ?? 0)
  const roundId = Number(map.get('rid')?.uint ?? 0)

  return {
    price: Number(priceScaled) / ORACLE_PRICE_SCALE,
    priceScaled,
    timestamp,
    roundId,
  }
}
