'use strict';
const { sha256, sign, verify, addressOf } = require('./crypto');

const COINBASE = 'COINBASE';

class Transaction {
  constructor({ from, fromPublicKey, to, amount, fee = 0, nonce, timestamp, signature }) {
    this.from = from;                   // sender address (or COINBASE)
    this.fromPublicKey = fromPublicKey; // needed to verify the signature
    this.to = to;
    this.amount = amount;
    this.fee = fee;                     // paid to the miner; prioritises the tx
    this.nonce = nonce;                 // per-account counter: stops replay attacks
    this.timestamp = timestamp;
    this.signature = signature;
  }

  payload() {
    return JSON.stringify([this.from, this.to, this.amount, this.fee, this.nonce, this.timestamp]);
  }

  get id() {
    return sha256(this.payload() + (this.signature || ''));
  }

  static reward(minerAddress, amount, height) {
    // `nonce` = block height keeps every coinbase transaction unique.
    return new Transaction({ from: COINBASE, to: minerAddress, amount, nonce: height, timestamp: 0 });
  }

  static create(wallet, to, amount, nonce, fee = 0) {
    const tx = new Transaction({
      from: wallet.address, fromPublicKey: wallet.publicKey,
      to, amount, fee, nonce, timestamp: Date.now(),
    });
    tx.signature = sign(tx.payload(), wallet.privateKey);
    return tx;
  }

  static from(obj) { return new Transaction(obj); }

  isCoinbase() { return this.from === COINBASE; }

  // Stateless checks: shape, address ownership and signature.
  validate() {
    if (this.isCoinbase()) return null;
    if (!Number.isInteger(this.amount) || this.amount <= 0) return 'amount must be a positive integer';
    if (!Number.isInteger(this.fee) || this.fee < 0) return 'fee must be a non-negative integer';
    if (!Number.isInteger(this.nonce) || this.nonce < 0) return 'bad nonce';
    if (!this.to || this.to === this.from) return 'invalid recipient';
    if (!this.fromPublicKey || !this.signature) return 'missing signature';
    if (addressOf(this.fromPublicKey) !== this.from) return 'public key does not match sender address';
    if (!verify(this.payload(), this.signature, this.fromPublicKey)) return 'invalid signature';
    return null;
  }
}

module.exports = { Transaction, COINBASE };
