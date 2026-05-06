import { describe, it, expect } from 'vitest'
import { DolanPredictionClient } from '../src/client.js'
import type { Round } from '../src/types.js'

const mockAlgod = {} as any

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    roundId: 1,
    lockPrice: 150000000,
    closePrice: 160000000,
    startTime: 1000,
    lockTime: 1300,
    endTime: 1600,
    upPool: 5000000,
    downPool: 3000000,
    upPoolSnapshot: 5000000,
    downPoolSnapshot: 3000000,
    totalPoolSnapshot: 8000000,
    rewardPoolSnapshot: 7760000,
    status: 1,
    outcome: 0,
    ...overrides,
  }
}

describe('DolanPredictionClient — read-only mode', () => {
  const client = new DolanPredictionClient({ algodClient: mockAlgod })

  it('calculatePayout works without signer', () => {
    const round = makeRound({ outcome: 1, upPoolSnapshot: 50_000_000, rewardPoolSnapshot: 97_000_000 })
    const payout = client.calculatePayout(10_000_000, 1, round)
    expect(payout).toBe((10_000_000 * 97_000_000) / 50_000_000)
  })

  it('calculateOdds works without signer', () => {
    const round = makeRound({ upPool: 50_000_000, downPool: 50_000_000 })
    const odds = client.calculateOdds(round)
    expect(odds.up).toBe(2)
    expect(odds.down).toBe(2)
  })

  it('isRoundBettable works without signer', () => {
    const round = makeRound({ status: 3 })
    expect(client.isRoundBettable(round)).toBe(false)
  })

  it('timeUntilLock works without signer', () => {
    const round = makeRound({ lockTime: 0 })
    expect(client.timeUntilLock(round)).toBe(0)
  })

  it('timeUntilClose works without signer', () => {
    const round = makeRound({ endTime: 0 })
    expect(client.timeUntilClose(round)).toBe(0)
  })
})

describe('DolanPredictionClient — signer guards', () => {
  const client = new DolanPredictionClient({ algodClient: mockAlgod })

  it('placeBet throws without signer', async () => {
    await expect(client.placeBet(1, 1, 1_000_000)).rejects.toThrow('signer and activeAddress required')
  })

  it('claimWinnings throws without signer', async () => {
    await expect(client.claimWinnings(1)).rejects.toThrow('signer and activeAddress required')
  })

  it('batchClaim throws without signer', async () => {
    await expect(client.batchClaim([1, 2])).rejects.toThrow('signer and activeAddress required')
  })
})

describe('DolanPredictionClient — address guards', () => {
  const client = new DolanPredictionClient({ algodClient: mockAlgod })

  it('getBet throws without address', async () => {
    await expect(client.getBet(1)).rejects.toThrow('activeAddress required')
  })

  it('getBetHistory throws without address', async () => {
    await expect(client.getBetHistory()).rejects.toThrow('activeAddress required')
  })

  it('getUnclaimedRounds throws without address', async () => {
    await expect(client.getUnclaimedRounds()).rejects.toThrow('activeAddress required')
  })
})

describe('DolanPredictionClient — event system', () => {
  it('on returns an unsubscribe function', () => {
    const client = new DolanPredictionClient({ algodClient: mockAlgod })
    let called = false
    const unsub = client.on('priceUpdate', () => { called = true })
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('stopPolling does not crash when called without startPolling', () => {
    const client = new DolanPredictionClient({ algodClient: mockAlgod })
    expect(() => client.stopPolling()).not.toThrow()
  })
})
