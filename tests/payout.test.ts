import { describe, it, expect } from 'vitest'
import { calculatePayout, calculateOdds, calculateExpectedValue } from '../src/utils/payout.js'
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
    status: 3,
    outcome: 0,
    ...overrides,
  }
}

describe('calculatePayout', () => {
  it('calculates correct payout for UP winner', () => {
    const round = makeRound({
      outcome: 1,
      upPoolSnapshot: 50_000_000,
      rewardPoolSnapshot: 97_000_000,
    })
    const payout = calculatePayout(10_000_000, 1, round)
    expect(payout).toBe((10_000_000 * 97_000_000) / 50_000_000)
  })

  it('calculates correct payout for DOWN winner', () => {
    const round = makeRound({
      outcome: 2,
      downPoolSnapshot: 25_000_000,
      rewardPoolSnapshot: 97_000_000,
    })
    const payout = calculatePayout(5_000_000, 2, round)
    expect(payout).toBe((5_000_000 * 97_000_000) / 25_000_000)
  })

  it('returns 0 for loser', () => {
    const round = makeRound({ outcome: 2 })
    expect(calculatePayout(10_000_000, 1, round)).toBe(0)
  })

  it('returns full bet on DRAW', () => {
    const round = makeRound({ outcome: 3 })
    expect(calculatePayout(10_000_000, 1, round)).toBe(10_000_000)
  })

  it('returns full bet on INVALID', () => {
    const round = makeRound({ outcome: 4 })
    expect(calculatePayout(10_000_000, 2, round)).toBe(10_000_000)
  })

  it('returns 0 when winning pool is 0', () => {
    const round = makeRound({
      outcome: 1,
      upPoolSnapshot: 0,
      rewardPoolSnapshot: 97_000_000,
    })
    expect(calculatePayout(10_000_000, 1, round)).toBe(0)
  })
})

describe('calculateOdds', () => {
  it('returns equal multipliers for 50/50 pools', () => {
    const round = makeRound({ upPool: 50_000_000, downPool: 50_000_000 })
    const odds = calculateOdds(round)
    expect(odds.up).toBe(2)
    expect(odds.down).toBe(2)
  })

  it('returns correct multipliers for unequal pools', () => {
    const round = makeRound({ upPool: 75_000_000, downPool: 25_000_000 })
    const odds = calculateOdds(round)
    expect(odds.up).toBeCloseTo(1.333, 2)
    expect(odds.down).toBe(4)
  })

  it('returns zeros for empty pools', () => {
    const round = makeRound({ upPool: 0, downPool: 0 })
    const odds = calculateOdds(round)
    expect(odds.up).toBe(0)
    expect(odds.down).toBe(0)
  })

  it('handles one pool being zero', () => {
    const round = makeRound({ upPool: 100_000_000, downPool: 0 })
    const odds = calculateOdds(round)
    expect(odds.up).toBe(1)
    expect(odds.down).toBe(100_000_000)
  })
})

describe('calculateExpectedValue', () => {
  it('returns positive EV with high win probability', () => {
    const round = makeRound({ upPool: 50_000_000, downPool: 50_000_000 })
    const ev = calculateExpectedValue(1_000_000, 1, round, 0.8)
    expect(ev).toBeGreaterThan(0)
  })

  it('returns negative EV with low win probability', () => {
    const round = makeRound({ upPool: 50_000_000, downPool: 50_000_000 })
    const ev = calculateExpectedValue(1_000_000, 1, round, 0.2)
    expect(ev).toBeLessThan(0)
  })

  it('returns negative EV when betting on heavily favored side', () => {
    const round = makeRound({ upPool: 98_000_000, downPool: 2_000_000 })
    const ev = calculateExpectedValue(1_000_000, 1, round, 0.5)
    expect(ev).toBeLessThan(0)
  })
})
