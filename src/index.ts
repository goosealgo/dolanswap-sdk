export { DolanPredictionClient } from './client.js'

export type {
  Round,
  Bet,
  OracleReading,
  BetDirection,
  RoundStatus,
  RoundOutcome,
  ClientConfig,
  UnclaimedRound,
  EventType,
  EventCallback,
} from './types.js'

export {
  PREDICTION_APP_ID,
  ORACLE_APP_ID,
  MIN_BET_MICROALGO,
  MAX_BET_MICROALGO,
  FEE_PERCENT,
  ROUND_INTERVAL_SEC,
  ORACLE_STALENESS_SEC,
  STATUS_OPEN,
  STATUS_LOCKED,
  STATUS_CLOSED,
  OUTCOME_PENDING,
  OUTCOME_UP,
  OUTCOME_DOWN,
  OUTCOME_DRAW,
  OUTCOME_INVALID,
} from './constants.js'

export { calculatePayout, calculateOdds, calculateExpectedValue } from './utils/payout.js'
export { isOpen, isLocked, timeUntilLock, timeUntilClose } from './utils/time.js'
