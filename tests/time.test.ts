import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isOpen, isLocked, timeUntilLock, timeUntilClose } from '../src/utils/time.js'
import type { Round } from '../src/types.js'

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    roundId: 1,
    lockPrice: 0,
    closePrice: 0,
    startTime: 0,
    lockTime: 0,
    endTime: 0,
    upPool: 0,
    downPool: 0,
    upPoolSnapshot: 0,
    downPoolSnapshot: 0,
    totalPoolSnapshot: 0,
    rewardPoolSnapshot: 0,
    status: 1,
    outcome: 0,
    ...overrides,
  }
}

const NOW = 1700000000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW * 1000)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isOpen', () => {
  it('returns true when OPEN and lockTime in the future', () => {
    const round = makeRound({ status: 1, lockTime: NOW + 60 })
    expect(isOpen(round)).toBe(true)
  })

  it('returns false when OPEN but lockTime in the past', () => {
    const round = makeRound({ status: 1, lockTime: NOW - 10 })
    expect(isOpen(round)).toBe(false)
  })

  it('returns false when status is LOCKED', () => {
    const round = makeRound({ status: 2, lockTime: NOW + 60 })
    expect(isOpen(round)).toBe(false)
  })
})

describe('isLocked', () => {
  it('returns true when LOCKED and endTime in the future', () => {
    const round = makeRound({ status: 2, endTime: NOW + 120 })
    expect(isLocked(round)).toBe(true)
  })

  it('returns false when LOCKED but endTime in the past', () => {
    const round = makeRound({ status: 2, endTime: NOW - 10 })
    expect(isLocked(round)).toBe(false)
  })

  it('returns false when status is OPEN', () => {
    const round = makeRound({ status: 1, endTime: NOW + 120 })
    expect(isLocked(round)).toBe(false)
  })
})

describe('timeUntilLock', () => {
  it('returns seconds until lockTime', () => {
    const round = makeRound({ lockTime: NOW + 60 })
    expect(timeUntilLock(round)).toBe(60)
  })

  it('returns 0 when lockTime has passed', () => {
    const round = makeRound({ lockTime: NOW - 30 })
    expect(timeUntilLock(round)).toBe(0)
  })
})

describe('timeUntilClose', () => {
  it('returns seconds until endTime', () => {
    const round = makeRound({ endTime: NOW + 120 })
    expect(timeUntilClose(round)).toBe(120)
  })

  it('returns 0 when endTime has passed', () => {
    const round = makeRound({ endTime: NOW - 30 })
    expect(timeUntilClose(round)).toBe(0)
  })
})
