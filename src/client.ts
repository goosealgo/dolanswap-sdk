import type algosdk from 'algosdk'
import type { ClientConfig, Round, Bet, OracleReading, UnclaimedRound, BetDirection, EventType, EventCallback } from './types.js'
import { PREDICTION_APP_ID, ORACLE_APP_ID } from './constants.js'
import { RateLimiter } from './utils/rate-limiter.js'
import { calculatePayout, calculateOdds, calculateExpectedValue } from './utils/payout.js'
import { isOpen, isLocked, timeUntilLock, timeUntilClose } from './utils/time.js'
import { getCurrentRoundId, getRound, getRounds, getOpenRounds, getLiveRound } from './modules/rounds.js'
import { placeBet, getBet, getBetHistory } from './modules/betting.js'
import { getUnclaimedRounds, claimWinnings, batchClaim } from './modules/claiming.js'
import { getOraclePrice } from './modules/oracle.js'
import { getLivePrice, streamPrice } from './modules/price.js'

export class DolanPredictionClient {
  private readonly algod: algosdk.Algodv2
  private readonly signer: algosdk.TransactionSigner | undefined
  private readonly address: string | undefined
  private readonly predictionAppId: number
  private readonly oracleAppId: number
  private readonly rateLimiter: RateLimiter
  private readonly pollIntervalMs: number

  private readonly listeners: Map<EventType, Set<EventCallback<any>>> = new Map()
  private readonly lastKnownStates: Map<number, number> = new Map()
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private priceUnsub: (() => void) | null = null

  constructor(config: ClientConfig) {
    this.algod = config.algodClient
    this.signer = config.signer
    this.address = config.activeAddress
    this.predictionAppId = config.predictionAppId ?? PREDICTION_APP_ID
    this.oracleAppId = config.oracleAppId ?? ORACLE_APP_ID
    this.rateLimiter = new RateLimiter(config.maxRequestsPerSecond ?? 10)
    this.pollIntervalMs = config.pollIntervalMs ?? 5000
  }

  async getCurrentRoundId(): Promise<number> {
    return getCurrentRoundId(this.algod, this.rateLimiter, this.predictionAppId)
  }

  async getRound(roundId: number): Promise<Round | null> {
    return getRound(this.rateLimiter, roundId, this.predictionAppId)
  }

  async getRounds(count?: number): Promise<Round[]> {
    return getRounds(this.rateLimiter, this.algod, count, this.predictionAppId)
  }

  async getOpenRounds(): Promise<Round[]> {
    return getOpenRounds(this.rateLimiter, this.algod, this.predictionAppId)
  }

  async getLiveRound(): Promise<Round | null> {
    return getLiveRound(this.rateLimiter, this.algod, this.predictionAppId)
  }

  private requireSigner(): { signer: algosdk.TransactionSigner; address: string } {
    if (!this.signer || !this.address) {
      throw new Error('signer and activeAddress required for this method')
    }
    return { signer: this.signer, address: this.address }
  }

  private requireAddress(address?: string): string {
    const addr = address ?? this.address
    if (!addr) throw new Error('activeAddress required for this method')
    return addr
  }

  async placeBet(roundId: number, direction: BetDirection, amountMicroAlgo: number): Promise<string> {
    const { signer, address } = this.requireSigner()
    return placeBet(this.algod, signer, address, roundId, direction, amountMicroAlgo, this.predictionAppId)
  }

  async getBet(roundId: number, address?: string): Promise<Bet | null> {
    return getBet(this.rateLimiter, roundId, this.requireAddress(address), this.predictionAppId)
  }

  async getBetHistory(address?: string): Promise<number[]> {
    return getBetHistory(this.rateLimiter, this.requireAddress(address), this.predictionAppId)
  }

  async getUnclaimedRounds(address?: string): Promise<UnclaimedRound[]> {
    return getUnclaimedRounds(this.rateLimiter, this.algod, this.requireAddress(address), this.predictionAppId)
  }

  async claimWinnings(roundId: number): Promise<string> {
    const { signer, address } = this.requireSigner()
    return claimWinnings(this.algod, signer, address, roundId, this.predictionAppId)
  }

  async batchClaim(roundIds: number[]): Promise<string[]> {
    const { signer, address } = this.requireSigner()
    return batchClaim(this.algod, signer, address, roundIds, this.predictionAppId)
  }

  async getOraclePrice(): Promise<OracleReading> {
    return getOraclePrice(this.algod, this.rateLimiter, this.oracleAppId)
  }

  async getLivePrice(): Promise<number> {
    return getLivePrice()
  }

  streamPrice(callback: (price: number) => void): () => void {
    return streamPrice(callback)
  }

  calculatePayout(betAmount: number, direction: BetDirection, round: Round): number {
    return calculatePayout(betAmount, direction, round)
  }

  calculateOdds(round: Round): { up: number; down: number } {
    return calculateOdds(round)
  }

  calculateExpectedValue(betAmount: number, direction: BetDirection, round: Round, winProbability: number): number {
    return calculateExpectedValue(betAmount, direction, round, winProbability)
  }

  isRoundBettable(round: Round): boolean {
    return isOpen(round)
  }

  timeUntilLock(round: Round): number {
    return timeUntilLock(round)
  }

  timeUntilClose(round: Round): number {
    return timeUntilClose(round)
  }

  on<T extends EventType>(event: T, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  startPolling(): void {
    if (this.pollTimer) return

    this.pollTimer = setInterval(() => this.pollTick(), this.pollIntervalMs)
    this.pollTick()

    this.priceUnsub = streamPrice((price) => {
      this.emit('priceUpdate', price)
    })
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.priceUnsub) {
      this.priceUnsub()
      this.priceUnsub = null
    }
    this.lastKnownStates.clear()
  }

  private async pollTick(): Promise<void> {
    try {
      const currentId = await this.getCurrentRoundId()
      if (currentId === 0) return

      const start = Math.max(1, currentId - 2)
      for (let i = start; i <= currentId; i++) {
        const round = await this.getRound(i)
        if (!round) continue

        const prevStatus = this.lastKnownStates.get(i)
        if (prevStatus !== round.status) {
          if (round.status === 1) this.emit('roundOpened', round)
          if (round.status === 2) this.emit('roundLocked', round)
          if (round.status === 3) this.emit('roundSettled', round)
          this.lastKnownStates.set(i, round.status)
        }
      }

      for (const id of this.lastKnownStates.keys()) {
        if (id < currentId - 10) this.lastKnownStates.delete(id)
      }
    } catch {}
  }

  private emit(event: EventType, data: any): void {
    const callbacks = this.listeners.get(event)
    if (!callbacks) return
    for (const cb of callbacks) {
      try { cb(data) } catch {}
    }
  }
}
