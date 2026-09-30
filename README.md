# MiniChain – Cryptocurrency Transaction System with Attack Lab
EC8204 Blockchain and Cyber Security – Group Project

A blockchain built from scratch in Node.js (zero dependencies). It records coin transfers between users and
covers block creation, hashing, proof-of-work, signed transactions, fees, a peer-to-peer network with fork
resolution, and full chain validation. It ships with an attack lab that tries to break it.

## Run
```bash
npm test           # 18 tests: signatures, fees, double spend, replay, tampering, 51% attack, P2P sync
npm run demo       # console walk-through of the attacks
npm run network    # 3 peers: gossip, mining, network split, fork resolution
npm start          # dashboard at http://localhost:3000
npm run node -- 4001 http://localhost:4002   # run your own peer (port, then known peers)
```
Requires Node 18+ (tested on 22).

## How it works
```
wallet ──sign──▶ transaction ──▶ mempool ──▶ miner builds block ──▶ proof-of-work ──▶ chain
 (ECDSA)         (nonce, fee)    (validated)   (Merkle root, reward+fees)   (N leading zeros)  │
                                      ▲                                                        │
                                      └──────── gossiped to peers, chains compared by work ◀───┘
```

| Concern | Mechanism | File |
|---|---|---|
| Identity | secp256k1 key pair; address = SHA-256(pubkey)[0:40] | `src/crypto.js` |
| Authenticity | ECDSA signature over (from, to, amount, fee, nonce, timestamp) | `src/transaction.js` |
| Replay / double spend | per-account nonce + balance check (amount + fee) on replayed state | `src/blockchain.js` |
| Integrity | Merkle root of tx ids + SHA-256 block hash linked to the previous hash | `src/blockchain.js` |
| Consensus | proof-of-work; the valid chain with most cumulative work wins | `src/blockchain.js` |
| Incentive | miner gets block reward + fees; a coinbase paying more is rejected | `src/blockchain.js` |
| Networking | HTTP peers gossip transactions and blocks, sync on join, reorganise on heavier forks | `src/node.js` |
| Reorg safety | payments from orphaned blocks return to the mempool if still valid | `src/blockchain.js` |

## Attacks demonstrated (`src/attacks.js`)
| Attack | Result | Why |
|---|---|---|
| Forged sender | Rejected | public key must hash to the sender address; signature must verify |
| Edited amount after signing | Rejected | signature no longer matches |
| Double spend | 2nd tx rejected | nonce already used / balance exhausted |
| Replay | Rejected | nonce already consumed |
| Miner overpays itself | Block rejected | coinbase must equal reward + fees |
| Tampering with an old block | Detected at the exact block | Merkle root / hash mismatch, links break downstream |
| 51% attack, small attacker | Rejected | fork has less cumulative work |
| 51% attack, majority attacker | **Succeeds** | history rewritten – the inherent limit of proof-of-work |

Mitigations for the 51% case: wait for several confirmations, raise difficulty / hash rate, add checkpoints,
or use a consensus with economic finality.

## Limitations
Fixed difficulty (no retargeting), peers are trusted to be reachable over plain HTTP with no authentication or
peer scoring, no persistence to disk, and the dashboard's demo wallets are held server-side so the page can
sign for you. A real client keeps private keys locally.
