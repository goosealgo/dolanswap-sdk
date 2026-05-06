export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly maxTokens: number
  private readonly refillRate: number

  constructor(maxRequestsPerSecond: number) {
    this.maxTokens = maxRequestsPerSecond
    this.tokens = maxRequestsPerSecond
    this.refillRate = maxRequestsPerSecond
    this.lastRefill = Date.now()
  }

  async acquire(): Promise<void> {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }
    const waitMs = ((1 - this.tokens) / this.refillRate) * 1000
    await sleep(waitMs)
    this.refill()
    this.tokens -= 1
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate)
    this.lastRefill = now
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
