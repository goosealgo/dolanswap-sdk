# dolanswap-sdk

SDK for interacting with DolanSwap prediction markets on Algorand.

[![npm](https://img.shields.io/npm/v/dolanswap-sdk)](https://www.npmjs.com/package/dolanswap-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
npm install dolanswap-sdk algosdk
```

## Quick Start

Read-only usage — no wallet required:

```typescript
import algosdk from 'algosdk'
import { DolanPredictionClient } from 'dolanswap-sdk'

const algod = new algosdk.Algodv2('', 'https://mainnet-api.algonode.cloud', 443)
const client = new DolanPredictionClient({ algodClient: algod })

const roundId = await client.getCurrentRoundId()
const round = await client.getRound(roundId)
console.log(round)
```

## Full Client Setup

With a wallet for betting and claiming:

```typescript
import algosdk from 'algosdk'
import { DolanPredictionClient } from 'dolanswap-sdk'

const account = algosdk.mnemonicToSecretKey('your mnemonic here')
const algod = new algosdk.Algodv2('', 'https://mainnet-api.algonode.cloud', 443)
const signer = algosdk.makeBasicAccountTransactionSigner(account)

const client = new DolanPredictionClient({
  algodClient: algod,
  signer,
  activeAddress: account.addr.toString(),
})
```

## API Reference

### Round Reading

| Method | Returns | Description |
|---|---|---|
| `getCurrentRoundId()` | `Promise<number>` | Current round ID from global state |
| `getRound(roundId)` | `Promise<Round \| null>` | Single round data from box storage |
| `getRounds(count?)` | `Promise<Round[]>` | Latest N rounds (default 10) |
| `getOpenRounds()` | `Promise<Round[]>` | Currently bettable rounds |
| `getLiveRound()` | `Promise<Round \| null>` | Currently locked/live round |

### Betting

| Method | Returns | Description |
|---|---|---|
| `placeBet(roundId, direction, amountMicroAlgo)` | `Promise<string>` | Place a bet, returns transaction ID |
| `getBet(roundId, address?)` | `Promise<Bet \| null>` | Read a user's bet for a round |
| `getBetHistory(address?)` | `Promise<number[]>` | All round IDs the user has bet on |

`direction`: `1` = UP, `2` = DOWN

`amountMicroAlgo`: Amount in microALGO (1 ALGO = 1,000,000 microALGO)

### Claiming

| Method | Returns | Description |
|---|---|---|
| `getUnclaimedRounds(address?)` | `Promise<UnclaimedRound[]>` | Rounds with unclaimed winnings/refunds |
| `claimWinnings(roundId)` | `Promise<string>` | Claim a single round, returns transaction ID |
| `batchClaim(roundIds)` | `Promise<string[]>` | Claim multiple rounds, returns transaction IDs |

### Oracle & Price

| Method | Returns | Description |
|---|---|---|
| `getOraclePrice()` | `Promise<OracleReading>` | On-chain oracle ALGO/USD price |
| `getLivePrice()` | `Promise<number>` | Live Coinbase ALGO/USD spot price |
| `streamPrice(callback)` | `() => void` | Stream live prices, returns unsubscribe function |

### Utilities

| Method | Returns | Description |
|---|---|---|
| `calculatePayout(betAmount, direction, round)` | `number` | Expected payout for a bet |
| `calculateOdds(round)` | `{ up, down }` | Current pool multipliers |
| `calculateExpectedValue(betAmount, direction, round, winProb)` | `number` | Expected value given win probability |
| `isRoundBettable(round)` | `boolean` | Whether the round is open for bets |
| `timeUntilLock(round)` | `number` | Seconds until betting closes |
| `timeUntilClose(round)` | `number` | Seconds until round settles |

### Events

```typescript
client.startPolling()

client.on('roundOpened', (round) => { /* new round open for betting */ })
client.on('roundLocked', (round) => { /* betting closed, round is live */ })
client.on('roundSettled', (round) => { /* round finished, check results */ })
client.on('priceUpdate', (price) => { /* live Coinbase ALGO/USD tick */ })

client.stopPolling()
```

| Event | Callback | Fires When |
|---|---|---|
| `roundOpened` | `(round: Round) => void` | A round's status transitions to OPEN |
| `roundLocked` | `(round: Round) => void` | A round's status transitions to LOCKED |
| `roundSettled` | `(round: Round) => void` | A round's status transitions to CLOSED |
| `priceUpdate` | `(price: number) => void` | New Coinbase ALGO/USD price tick |

## Constants

All exported and available for direct use:

| Constant | Value |
|---|---|
| `PREDICTION_APP_ID` | 3534901984 |
| `ORACLE_APP_ID` | 3534900173 |
| `MIN_BET_MICROALGO` | 1,000,000 (1 ALGO) |
| `MAX_BET_MICROALGO` | 1,000,000,000 (1000 ALGO) |
| `FEE_PERCENT` | 3 |
| `ROUND_INTERVAL_SEC` | 300 |
| `ORACLE_STALENESS_SEC` | 600 |
| `STATUS_OPEN` / `STATUS_LOCKED` / `STATUS_CLOSED` | 1 / 2 / 3 |
| `OUTCOME_PENDING` / `OUTCOME_UP` / `OUTCOME_DOWN` / `OUTCOME_DRAW` / `OUTCOME_INVALID` | 0 / 1 / 2 / 3 / 4 |

## Examples

Runnable scripts in the `examples/` directory:

```bash
# Read current rounds and prices
npx tsx examples/read-rounds.ts

# Place a bet (requires MNEMONIC env var)
MNEMONIC="your mnemonic" npx tsx examples/place-bet.ts

# Claim all unclaimed winnings
MNEMONIC="your mnemonic" npx tsx examples/claim-winnings.ts

# Stream live vs oracle price spread
npx tsx examples/monitor-prices.ts

# Run a simple spread-based bot
MNEMONIC="your mnemonic" npx tsx examples/simple-bot.ts
```

## Game Rules

- 5-minute betting window + 5-minute live window per round
- Bet: 1 to 1,000 ALGO per wallet per round
- Directions: UP or DOWN (one per wallet per round)
- Fees: 3% on winning rounds only (1.5% treasury + 1.5% dev)
- Draw/Invalid rounds: full refund, zero fees
- Payout: `(bet_amount x reward_pool) / winning_pool`

## License

MIT
