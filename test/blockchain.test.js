'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Blockchain, Transaction } = require('../src/blockchain');
const { createWallet } = require('../src/crypto');
const attacks = require('../src/attacks');

const setup = () => {
  const alice = createWallet(), bob = createWallet(), miner = createWallet();
  const bc = new Blockchain({ difficulty: 2, reward: 50 });
  bc.minePending(alice.address); // alice: 50
  return { alice, bob, miner, bc };
};

test('mining pays the reward and satisfies proof of work', () => {
  const { alice, bc } = setup();
  assert.strictEqual(bc.balanceOf(alice.address), 50);
  assert.ok(bc.latest.hash.startsWith('00'));
});

test('signed transfer moves funds once mined', () => {
  const { alice, bob, miner, bc } = setup();
  bc.addTransaction(Transaction.create(alice, bob.address, 20, bc.nextNonce(alice.address)));
  bc.minePending(miner.address);
  assert.strictEqual(bc.balanceOf(alice.address), 30);
  assert.strictEqual(bc.balanceOf(bob.address), 20);
  assert.strictEqual(bc.balanceOf(miner.address), 50);
  assert.ok(bc.isValid().valid);
});

test('rejects forged signature', () => {
  const { alice, bob, bc } = setup();
  const mallory = createWallet();
  const tx = Transaction.create(mallory, bob.address, 5, 0);
  tx.from = alice.address; // pretend to be alice
  assert.throws(() => bc.addTransaction(tx), /does not match|invalid signature/);
});

test('rejects payload altered after signing', () => {
  const { alice, bob, bc } = setup();
  const tx = Transaction.create(alice, bob.address, 5, 0);
  tx.amount = 50;
  assert.throws(() => bc.addTransaction(tx), /invalid signature/);
});

test('rejects overspend and non-positive amounts', () => {
  const { alice, bob, bc } = setup();
  assert.throws(() => bc.addTransaction(Transaction.create(alice, bob.address, 51, 0)), /insufficient/);
  assert.throws(() => bc.addTransaction(Transaction.create(alice, bob.address, 0, 0)), /positive/);
  assert.throws(() => bc.addTransaction(Transaction.create(alice, bob.address, -5, 0)), /positive/);
});

test('double spend: second conflicting tx is rejected', () => {
  const { alice, bob, miner, bc } = setup();
  const r = attacks.doubleSpend(bc, alice, bob.address, miner.address, 40);
  assert.strictEqual(r.first, 'accepted');
  assert.match(r.second, /bad nonce|insufficient/);
});

test('replay of a confirmed transaction is rejected', () => {
  const { alice, bob, miner, bc } = setup();
  const tx = bc.addTransaction(Transaction.create(alice, bob.address, 10, 0));
  bc.minePending(miner.address);
  assert.match(attacks.replay(bc, tx), /bad nonce/);
});

test('tampering with a mined transaction is detected', () => {
  const { alice, bob, miner, bc } = setup();
  bc.addTransaction(Transaction.create(alice, bob.address, 10, 0));
  bc.minePending(miner.address);
  attacks.tamper(bc, 2, 1000);
  const v = bc.isValid();
  assert.strictEqual(v.valid, false);
  assert.strictEqual(v.atBlock, 2);
});

test('tampering + recomputing the hash still breaks the next link', () => {
  const { bc, miner } = setup();
  bc.minePending(miner.address);
  const b = bc.chain[1];
  b.nonce = 12345; b.hash = b.computeHash();
  assert.strictEqual(bc.isValid().valid, false);
});

test('51% attack: longer fork rewrites history; shorter fork fails', () => {
  const { alice, bob, miner, bc } = setup();
  const attacker = createWallet();
  bc.addTransaction(Transaction.create(alice, bob.address, 30, 0));
  bc.minePending(miner.address);                 // block 2 holds the payment
  bc.minePending(miner.address);                 // block 3
  const weak = attacks.fiftyOnePercent(bc, { forkFrom: 1, attackerBlocks: 1, attackerAddress: attacker.address });
  assert.strictEqual(weak.replaced, false);
  const strong = attacks.fiftyOnePercent(bc, { forkFrom: 1, attackerBlocks: 3, attackerAddress: attacker.address });
  assert.strictEqual(strong.replaced, true);
  assert.strictEqual(bc.balanceOf(bob.address), 0); // payment erased
});

test('a fork with invalid blocks is never accepted', () => {
  const { bc, miner } = setup();
  bc.minePending(miner.address);
  const fake = JSON.parse(JSON.stringify(bc.chain));
  fake.push({ ...fake[fake.length - 1], index: 3, previousHash: 'bad' });
  assert.strictEqual(bc.replaceChain(fake).replaced, false);
});

test('fees go to the miner; balance must cover amount + fee', () => {
  const { alice, bob, miner, bc } = setup();
  bc.addTransaction(Transaction.create(alice, bob.address, 20, 0, 5));
  assert.throws(() => bc.addTransaction(Transaction.create(alice, bob.address, 26, 1, 5)), /insufficient/);
  bc.minePending(miner.address);
  assert.strictEqual(bc.balanceOf(alice.address), 25);
  assert.strictEqual(bc.balanceOf(miner.address), 55);
  assert.ok(bc.isValid().valid);
});

test('a miner cannot pay itself more than reward + fees', () => {
  const { alice, bob, miner, bc } = setup();
  bc.addTransaction(Transaction.create(alice, bob.address, 10, 0, 2));
  bc.minePending(miner.address);
  const b = bc.chain[2];
  b.transactions[0].amount += 1000;
  assert.strictEqual(bc.isValid().valid, false);
});

test('reorg: payments from orphaned blocks return to the mempool if still valid', () => {
  const { alice, bob, miner, bc } = setup();
  const rival = createWallet();
  bc.addTransaction(Transaction.create(alice, bob.address, 10, 0));
  bc.minePending(miner.address);                       // block 2 holds alice -> bob
  // Rival fork from block 1 that does NOT include the payment, but is heavier.
  const fork = new Blockchain({ difficulty: 2, reward: 50 });
  fork.chain = JSON.parse(JSON.stringify(bc.chain.slice(0, 2))).map((b) => new (require('../src/blockchain').Block)(b));
  for (let i = 0; i < 3; i++) fork.minePending(rival.address);
  const r = bc.replaceChain(JSON.parse(JSON.stringify(fork.chain)));
  assert.strictEqual(r.replaced, true);
  assert.strictEqual(r.requeued, 1);
  assert.strictEqual(bc.mempool.length, 1);
  assert.strictEqual(bc.balanceOf(bob.address), 0);    // not confirmed yet...
  bc.minePending(miner.address);
  assert.strictEqual(bc.balanceOf(bob.address), 10);   // ...but confirmed once re-mined
});
