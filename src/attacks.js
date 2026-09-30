'use strict';
// Attack simulations used by the demo script, the tests and the dashboard.
const { Block, Blockchain, Transaction } = require('./blockchain');
const { createWallet } = require('./crypto');

const clone = (chain) => JSON.parse(JSON.stringify(chain));

// 1. Tampering: rewrite an old transaction amount and see which rule catches it.
function tamper(bc, blockIndex, newAmount) {
  const tx = bc.chain[blockIndex].transactions.find((t) => !t.isCoinbase());
  if (!tx) return false;
  tx.amount = newAmount;
  return true;
}

// 2. Double spend: same funds signed to two recipients; second must be rejected.
function doubleSpend(bc, wallet, to1, to2, amount) {
  const nonce = bc.nextNonce(wallet.address);
  const first = Transaction.create(wallet, to1, amount, nonce);
  const second = Transaction.create(wallet, to2, amount, nonce);
  const out = { first: 'accepted', second: 'accepted' };
  try { bc.addTransaction(first); } catch (e) { out.first = e.message; }
  try { bc.addTransaction(second); } catch (e) { out.second = e.message; }
  return out;
}

// 3. Replay: rebroadcast an already-confirmed transaction.
function replay(bc, tx) {
  try { bc.addTransaction(tx); return 'accepted'; } catch (e) { return e.message; }
}

// 4. 51% attack: attacker secretly mines a longer fork that leaves out a victim
//    payment, then publishes it. Succeeds only when the fork has more total work.
function fiftyOnePercent(bc, { forkFrom, attackerBlocks, attackerAddress }) {
  const fork = new Blockchain({ difficulty: bc.difficulty, reward: bc.reward });
  fork.chain = bc.chain.slice(0, forkFrom + 1).map((b) => new Block({ ...clone(b), transactions: clone(b.transactions) }));
  for (let i = 0; i < attackerBlocks; i++) fork.minePending(attackerAddress);
  const before = bc.chain.length;
  const result = bc.replaceChain(clone(fork.chain));
  return { ...result, honestLength: before, forkLength: fork.chain.length, newLength: bc.chain.length };
}

module.exports = { tamper, doubleSpend, replay, fiftyOnePercent, createWallet };
