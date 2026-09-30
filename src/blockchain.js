'use strict';
const { sha256, merkleRoot } = require('./crypto');
const { Transaction } = require('./transaction');

const DEFAULTS = { difficulty: 4, reward: 50 };

class Block {
  constructor({ index, previousHash, timestamp, transactions, nonce = 0, difficulty, hash }) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.transactions = transactions.map((t) => (t instanceof Transaction ? t : Transaction.from(t)));
    this.nonce = nonce;
    this.difficulty = difficulty;
    this.merkleRoot = merkleRoot(this.transactions.map((t) => t.id));
    this.hash = hash || this.computeHash();
  }

  computeHash() {
    return sha256([this.index, this.previousHash, this.timestamp, this.merkleRoot, this.nonce, this.difficulty].join('|'));
  }

  // Proof of work: find a nonce so the hash starts with `difficulty` zeros.
  mine() {
    const target = '0'.repeat(this.difficulty);
    do { this.nonce++; this.hash = this.computeHash(); } while (!this.hash.startsWith(target));
    return this;
  }
}

class Blockchain {
  constructor({ difficulty = DEFAULTS.difficulty, reward = DEFAULTS.reward } = {}) {
    this.difficulty = difficulty;
    this.reward = reward;
    this.mempool = [];
    this.chain = [this.genesis()];
  }

  genesis() {
    // Fixed timestamp => every node derives the identical genesis block.
    return new Block({ index: 0, previousHash: '0'.repeat(64), timestamp: 0, transactions: [], difficulty: 0 });
  }

  get latest() { return this.chain[this.chain.length - 1]; }

  // ---- account state, derived by replaying the chain --------------------
  static applyBlockTxs(txs, state, reward, minerHint) {
    // Returns an error string or null; mutates `state` ({balances, nonces}).
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      if (tx.isCoinbase()) {
        if (i !== 0) return 'coinbase must be the first and only reward transaction';
        const fees = txs.slice(1).reduce((a, t) => a + (t.fee || 0), 0);
        if (tx.amount !== reward + fees) return 'wrong block reward (must equal reward + fees)';
        state.balances[tx.to] = (state.balances[tx.to] || 0) + tx.amount;
        continue;
      }
      const err = tx.validate();
      if (err) return `tx ${tx.id.slice(0, 8)}: ${err}`;
      if ((state.nonces[tx.from] || 0) !== tx.nonce) return `tx ${tx.id.slice(0, 8)}: bad nonce (replay or gap)`;
      if ((state.balances[tx.from] || 0) < tx.amount + tx.fee) return `tx ${tx.id.slice(0, 8)}: insufficient balance (double spend)`;
      state.balances[tx.from] -= tx.amount + tx.fee;
      state.balances[tx.to] = (state.balances[tx.to] || 0) + tx.amount;
      state.nonces[tx.from] = tx.nonce + 1;
    }
    return null;
  }

  state(chain = this.chain) {
    const state = { balances: {}, nonces: {} };
    for (const b of chain) Blockchain.applyBlockTxs(b.transactions, state, this.reward);
    return state;
  }

  balanceOf(address) { return this.state().balances[address] || 0; }

  nextNonce(address) {
    // Includes pending mempool txs so a wallet can queue several payments.
    const pending = this.mempool.filter((t) => t.from === address).length;
    return (this.state().nonces[address] || 0) + pending;
  }

  // ---- transactions -----------------------------------------------------
  addTransaction(input) {
    const tx = input instanceof Transaction ? input : Transaction.from(input);
    const err = tx.validate();
    if (err) throw new Error(err);
    if (this.mempool.some((t) => t.id === tx.id)) throw new Error('duplicate transaction');
    // Dry-run against confirmed state + already-pending txs.
    const state = this.state();
    const trial = [...this.mempool, tx];
    const e2 = Blockchain.applyBlockTxs(trial, state, this.reward);
    if (e2) throw new Error(e2);
    this.mempool.push(tx);
    return tx;
  }

  // ---- mining -----------------------------------------------------------
  minePending(minerAddress) {
    // Highest fee first, but keep each sender's nonce order.
    const pending = [...this.mempool].sort((a, b) => a.from === b.from ? a.nonce - b.nonce : b.fee - a.fee);
    const fees = pending.reduce((a, t) => a + t.fee, 0);
    const coinbase = Transaction.reward(minerAddress, this.reward + fees, this.chain.length);
    const block = new Block({
      index: this.chain.length,
      previousHash: this.latest.hash,
      timestamp: Date.now(),
      transactions: [coinbase, ...pending],
      difficulty: this.difficulty,
    }).mine();
    this.chain.push(block);
    this.mempool = [];
    return block;
  }

  // ---- validation -------------------------------------------------------
  // Returns { valid, error, atBlock }. Re-checks every rule from genesis.
  static validateChain(chain, { reward = DEFAULTS.reward, minDifficulty = 1 } = {}) {
    const g = new Blockchain({ reward }).genesis();
    if (chain[0].hash !== g.hash) return { valid: false, error: 'genesis mismatch', atBlock: 0 };
    const state = { balances: {}, nonces: {} };
    for (let i = 1; i < chain.length; i++) {
      const b = chain[i], prev = chain[i - 1];
      const fail = (error) => ({ valid: false, error, atBlock: i });
      if (b.index !== i) return fail('bad index');
      if (b.previousHash !== prev.hash) return fail('broken link: previousHash does not match');
      if (b.merkleRoot !== merkleRoot(b.transactions.map((t) => t.id))) return fail('merkle root mismatch (transactions altered)');
      if (b.hash !== b.computeHash()) return fail('block hash mismatch (block altered)');
      if (b.difficulty < minDifficulty || !b.hash.startsWith('0'.repeat(b.difficulty))) return fail('insufficient proof of work');
      const err = Blockchain.applyBlockTxs(b.transactions, state, reward);
      if (err) return fail(err);
    }
    return { valid: true };
  }

  isValid() { return Blockchain.validateChain(this.chain, { reward: this.reward }); }

  // Longest-chain (most cumulative work) rule for resolving forks.
  static work(chain) { return chain.reduce((w, b) => w + 16 ** b.difficulty, 0); }

  replaceChain(candidate) {
    const chain = candidate.map((b) => new Block({ ...b, transactions: b.transactions }));
    const check = Blockchain.validateChain(chain, { reward: this.reward });
    if (!check.valid) return { replaced: false, reason: check.error };
    if (Blockchain.work(chain) <= Blockchain.work(this.chain)) return { replaced: false, reason: 'not more work than current chain' };
    const orphaned = this.chain.flatMap((b) => b.transactions).filter((t) => !t.isCoinbase());
    this.chain = chain;
    const confirmed = new Set(chain.flatMap((b) => b.transactions.map((t) => t.id)));
    // Keep pending txs, and give transactions from dropped blocks a second chance
    // if they are still valid on the new chain.
    const candidates = [...orphaned, ...this.mempool].filter((t) => !confirmed.has(t.id));
    this.mempool = [];
    const requeued = [];
    for (const t of candidates) {
      try { this.addTransaction(t); requeued.push(t.id); } catch { /* now invalid: dropped */ }
    }
    return { replaced: true, requeued: requeued.length };
  }

  toJSON() { return { difficulty: this.difficulty, reward: this.reward, chain: this.chain, mempool: this.mempool }; }
}

module.exports = { Block, Blockchain, Transaction };
