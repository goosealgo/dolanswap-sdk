import type { Round } from '../types.js'
import { STATUS_OPEN, STATUS_LOCKED } from '../constants.js'

export function isOpen(round: Round): boolean {
  return round.status === STATUS_OPEN && (round.lockTime === 0 || nowSec() < round.lockTime)
}

export function isLocked(round: Round): boolean {
  return round.status === STATUS_LOCKED && nowSec() < round.endTime
}

export function timeUntilLock(round: Round): number {
  if (round.lockTime === 0) return Infinity
  return Math.max(0, round.lockTime - nowSec())
}

export function timeUntilClose(round: Round): number {
  if (round.endTime === 0) return Infinity
  return Math.max(0, round.endTime - nowSec())
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}
