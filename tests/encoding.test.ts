import { describe, it, expect } from 'vitest'
import {
  encodeRoundBoxName,
  encodeBetBoxName,
  encodeForfeitedBoxName,
  decodeRoundIdFromBox,
  decodeAlgorandAddress,
  parseRoundBox,
  parseBetBox,
} from '../src/utils/encoding.js'

describe('encodeRoundBoxName', () => {
  it('encodes round ID with prefix 0x72 and length 9', () => {
    const result = encodeRoundBoxName(1)
    expect(result[0]).toBe(0x72)
    expect(result.length).toBe(9)
  })

  it('encodes round ID 0 correctly', () => {
    const result = encodeRoundBoxName(0)
    const view = new DataView(result.buffer)
    expect(view.getBigUint64(1)).toBe(0n)
  })

  it('encodes large round ID correctly', () => {
    const result = encodeRoundBoxName(999999)
    const view = new DataView(result.buffer)
    expect(view.getBigUint64(1)).toBe(999999n)
  })
})

describe('encodeBetBoxName', () => {
  it('encodes with prefix 0x62 and length 41', () => {
    const addr = 'O34TXQHCKUPCWTF4KAO5FMXB6KQ7L6CTJR3CWTTZZXSJUPFFQQWKSPFGLY'
    const result = encodeBetBoxName(1, addr)
    expect(result[0]).toBe(0x62)
    expect(result.length).toBe(41)
  })
})

describe('encodeForfeitedBoxName', () => {
  it('encodes with prefix 0x66 and length 9', () => {
    const result = encodeForfeitedBoxName(42)
    expect(result[0]).toBe(0x66)
    expect(result.length).toBe(9)
  })
})

describe('decodeRoundIdFromBox', () => {
  it('round-trips with encodeRoundBoxName', () => {
    const encoded = encodeRoundBoxName(12345)
    const decoded = decodeRoundIdFromBox(encoded)
    expect(decoded).toBe(12345)
  })
})

describe('decodeAlgorandAddress', () => {
  it('decodes a mainnet address to 32 bytes', () => {
    const addr = 'O34TXQHCKUPCWTF4KAO5FMXB6KQ7L6CTJR3CWTTZZXSJUPFFQQWKSPFGLY'
    const result = decodeAlgorandAddress(addr)
    expect(result.length).toBe(32)
  })
})

describe('parseRoundBox', () => {
  it('parses a valid 114-byte buffer', () => {
    const buf = new Uint8Array(114)
    const view = new DataView(buf.buffer)
    view.setBigUint64(0, 150000000n)
    view.setBigUint64(8, 160000000n)
    view.setBigUint64(16, 1000n)
    view.setBigUint64(24, 1300n)
    view.setBigUint64(32, 1600n)
    view.setBigUint64(40, 5000000n)
    view.setBigUint64(48, 3000000n)
    view.setBigUint64(56, 5000000n)
    view.setBigUint64(64, 3000000n)
    view.setBigUint64(72, 8000000n)
    view.setBigUint64(80, 7760000n)
    buf[112] = 3
    buf[113] = 1

    const round = parseRoundBox(buf, 42)
    expect(round.roundId).toBe(42)
    expect(round.lockPrice).toBe(150000000)
    expect(round.closePrice).toBe(160000000)
    expect(round.startTime).toBe(1000)
    expect(round.lockTime).toBe(1300)
    expect(round.endTime).toBe(1600)
    expect(round.upPool).toBe(5000000)
    expect(round.downPool).toBe(3000000)
    expect(round.upPoolSnapshot).toBe(5000000)
    expect(round.downPoolSnapshot).toBe(3000000)
    expect(round.totalPoolSnapshot).toBe(8000000)
    expect(round.rewardPoolSnapshot).toBe(7760000)
    expect(round.status).toBe(3)
    expect(round.outcome).toBe(1)
  })

  it('throws on buffer shorter than 114 bytes', () => {
    const buf = new Uint8Array(50)
    expect(() => parseRoundBox(buf, 1)).toThrow('Round box too short')
  })
})

describe('parseBetBox', () => {
  it('parses a valid 10-byte buffer', () => {
    const buf = new Uint8Array(10)
    const view = new DataView(buf.buffer)
    view.setBigUint64(0, 1000000n)
    buf[8] = 1
    buf[9] = 0

    const bet = parseBetBox(buf)
    expect(bet.amount).toBe(1000000)
    expect(bet.direction).toBe(1)
    expect(bet.claimed).toBe(false)
  })

  it('throws on buffer shorter than 10 bytes', () => {
    const buf = new Uint8Array(5)
    expect(() => parseBetBox(buf)).toThrow('Bet box too short')
  })
})
