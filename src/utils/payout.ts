import type { Round, BetDirection } from '../types.js'
import { FEE_PERCENT, OUTCOME_DRAW, OUTCOME_INVALID, OUTCOME_UP, OUTCOME_DOWN } from '../constants.js'

export function calculatePayout(betAmount: number, direction: BetDirection, round: Round): number {
  if (round.outcome === OUTCOME_DRAW || round.outcome === OUTCOME_INVALID) {
    return betAmount
  }

  const winningDirection = round.outcome === OUTCOME_UP ? 1 : round.outcome === OUTCOME_DOWN ? 2 : 0
  if (direction !== winningDirection) return 0

  const rewardPool = round.rewardPoolSnapshot
  const winningPool = direction === 1 ? round.upPoolSnapshot : round.downPoolSnapshot
  if (winningPool === 0) return 0

  return (betAmount * rewardPool) / winningPool
}

export function calculateOdds(round: Round): { up: number; down: number } {
  const total = round.upPool + round.downPool
  if (total === 0) return { up: 0, down: 0 }
  return {
    up: total / (round.upPool || 1),
    down: total / (round.downPool || 1),
  }
}

export function calculateExpectedValue(
  betAmount: number,
  direction: BetDirection,
  round: Round,
  winProbability: number,
): number {
  const total = round.upPool + round.downPool + betAmount
  const rewardPool = total * (1 - FEE_PERCENT / 100)
  const winningPool = (direction === 1 ? round.upPool : round.downPool) + betAmount
  const potentialPayout = (betAmount * rewardPool) / winningPool
  return potentialPayout * winProbability - betAmount * (1 - winProbability)
}
