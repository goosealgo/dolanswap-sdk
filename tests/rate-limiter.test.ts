import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimiter } from '../src/utils/rate-limiter.js'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RateLimiter', () => {
  it('resolves immediately on first acquire', async () => {
    const limiter = new RateLimiter(10)
    await limiter.acquire()
  })

  it('handles burst up to max tokens', async () => {
    const limiter = new RateLimiter(10)
    for (let i = 0; i < 10; i++) {
      await limiter.acquire()
    }
  })

  it('throttles when tokens are exhausted', async () => {
    const limiter = new RateLimiter(2)
    await limiter.acquire()
    await limiter.acquire()

    let resolved = false
    const promise = limiter.acquire().then(() => { resolved = true })

    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(1000)
    await promise

    expect(resolved).toBe(true)
  })

  it('refills tokens over time', async () => {
    const limiter = new RateLimiter(5)
    for (let i = 0; i < 5; i++) {
      await limiter.acquire()
    }

    vi.advanceTimersByTime(2000)

    await limiter.acquire()
  })
})
