import { BOX_PREFIX_ROUND, BOX_PREFIX_BET, BOX_PREFIX_FORFEITED } from '../constants.js'

export function encodeRoundBoxName(roundId: number): Uint8Array {
  const buf = new Uint8Array(9)
  buf[0] = BOX_PREFIX_ROUND
  new DataView(buf.buffer).setBigUint64(1, BigInt(roundId))
  return buf
}

export function encodeBetBoxName(roundId: number, address: string): Uint8Array {
  const buf = new Uint8Array(41)
  buf[0] = BOX_PREFIX_BET
  new DataView(buf.buffer).setBigUint64(1, BigInt(roundId))
  buf.set(decodeAlgorandAddress(address), 9)
  return buf
}

export function encodeForfeitedBoxName(roundId: number): Uint8Array {
  const buf = new Uint8Array(9)
  buf[0] = BOX_PREFIX_FORFEITED
  new DataView(buf.buffer).setBigUint64(1, BigInt(roundId))
  return buf
}

export function decodeRoundIdFromBox(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset)
  return Number(view.getBigUint64(1))
}

export function decodeAlgorandAddress(addr: string): Uint8Array {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const lookup = new Uint8Array(128)
  for (let i = 0; i < CHARS.length; i++) lookup[CHARS.charCodeAt(i)] = i
  const bits: number[] = []
  for (let i = 0; i < addr.length; i++) {
    const val = lookup[addr.charCodeAt(i)]
    for (let b = 4; b >= 0; b--) bits.push((val >> b) & 1)
  }
  const bytes = new Uint8Array(36)
  for (let i = 0; i < 36; i++) {
    let byte = 0
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i * 8 + b] ?? 0)
    bytes[i] = byte
  }
  return bytes.slice(0, 32)
}

export function parseRoundBox(bytes: Uint8Array, roundId: number) {
  if (bytes.length < 114) throw new Error(`Round box too short: ${bytes.length}`)
  const view = new DataView(bytes.buffer, bytes.byteOffset)
  return {
    roundId,
    lockPrice: Number(view.getBigUint64(0)),
    closePrice: Number(view.getBigUint64(8)),
    startTime: Number(view.getBigUint64(16)),
    lockTime: Number(view.getBigUint64(24)),
    endTime: Number(view.getBigUint64(32)),
    upPool: Number(view.getBigUint64(40)),
    downPool: Number(view.getBigUint64(48)),
    upPoolSnapshot: Number(view.getBigUint64(56)),
    downPoolSnapshot: Number(view.getBigUint64(64)),
    totalPoolSnapshot: Number(view.getBigUint64(72)),
    rewardPoolSnapshot: Number(view.getBigUint64(80)),
    status: bytes[112],
    outcome: bytes[113],
  }
}

export function parseBetBox(bytes: Uint8Array) {
  if (bytes.length < 10) throw new Error(`Bet box too short: ${bytes.length}`)
  const view = new DataView(bytes.buffer, bytes.byteOffset)
  return {
    amount: Number(view.getBigUint64(0)),
    direction: bytes[8] as 1 | 2,
    claimed: bytes[9] !== 0,
  }
}
