import type { Round } from '../types.js'
import { STATUS_OPEN, STATUS_LOCKED } from '../constants.js'

export function isOpen(round: Round): boolean {
  return round.status === STATUS_OPEN && nowSec() < round.lockTime
}

export function isLocked(round: Round): boolean {
  return round.status === STATUS_LOCKED && nowSec() < round.endTime
}

export function timeUntilLock(round: Round): number {
  return Math.max(0, round.lockTime - nowSec())
}

export function timeUntilClose(round: Round): number {
  return Math.max(0, round.endTime - nowSec())
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}
