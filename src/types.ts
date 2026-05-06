export type BetDirection = 1 | 2

export const enum RoundStatus {
  OPEN = 1,
  LOCKED = 2,
  CLOSED = 3,
}

export const enum RoundOutcome {
  PENDING = 0,
  UP = 1,
  DOWN = 2,
  DRAW = 3,
  INVALID = 4,
}

export interface Round {
  roundId: number
  lockPrice: number
  closePrice: number
  startTime: number
  lockTime: number
  endTime: number
  upPool: number
  downPool: number
  upPoolSnapshot: number
  downPoolSnapshot: number
  totalPoolSnapshot: number
  rewardPoolSnapshot: number
  status: RoundStatus
  outcome: RoundOutcome
}

export interface Bet {
  amount: number
  direction: BetDirection
  claimed: boolean
}

export interface OracleReading {
  price: number
  priceScaled: bigint
  timestamp: number
  roundId: number
}

export interface UnclaimedRound {
  roundId: number
  bet: Bet
  payout: number
}

import type algosdk from 'algosdk'

export interface ClientConfig {
  algodClient: algosdk.Algodv2
  signer?: algosdk.TransactionSigner
  activeAddress?: string
  predictionAppId?: number
  oracleAppId?: number
  maxRequestsPerSecond?: number
  pollIntervalMs?: number
}

export type EventType = 'roundOpened' | 'roundLocked' | 'roundSettled' | 'priceUpdate'

export type EventCallback<T extends EventType> =
  T extends 'priceUpdate' ? (price: number) => void : (round: Round) => void
