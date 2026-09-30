'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createNode } = require('../src/node');
const { Transaction } = require('../src/blockchain');
const { createWallet } = require('../src/crypto');

const call = async (node, path, body) => {
  const r = await fetch(node.url + path, body ? { method: 'POST', body: JSON.stringify(body) } : {});
  return { status: r.status, body: await r.json() };
};
const settle = () => new Promise((r) => setTimeout(r, 300));

test('three nodes converge: gossip tx, mine, propagate block, late joiner syncs', async () => {
  const [a, b, c] = [createNode({ port: 4101, difficulty: 2 }), createNode({ port: 4102, difficulty: 2 }), createNode({ port: 4103, difficulty: 2 })];
  await Promise.all([a.start(), b.start(), c.start()]);
  try {
    const alice = createWallet(), bob = createWallet(), miner = createWallet();
    await call(b, '/peers', { url: a.url });
    await call(c, '/peers', { url: b.url });          // line topology a - b - c
    await call(a, '/mine', { miner: alice.address }); await settle();
    assert.strictEqual(c.bc.chain.length, 2, 'block reached node 2 hops away');

    await call(a, '/tx', { tx: Transaction.create(alice, bob.address, 15, 0, 1) }); await settle();
    assert.strictEqual(c.bc.mempool.length, 1, 'tx gossiped to every node');

    await call(c, '/mine', { miner: miner.address }); await settle();
    for (const n of [a, b, c]) {
      assert.strictEqual(n.bc.chain.length, 3);
      assert.strictEqual(n.bc.balanceOf(bob.address), 15);
      assert.strictEqual(n.bc.balanceOf(miner.address), 51);
      assert.strictEqual(n.bc.latest.hash, a.bc.latest.hash);
    }

    const d = createNode({ port: 4104, difficulty: 2 }); await d.start();
    try { await call(d, '/peers', { url: c.url }); assert.strictEqual(d.bc.chain.length, 3, 'late joiner downloads chain'); }
    finally { await d.stop(); }
  } finally { await Promise.all([a.stop(), b.stop(), c.stop()]); }
});

test('node rejects an invalid transaction and a forged block', async () => {
  const n = createNode({ port: 4105, difficulty: 2 }); await n.start();
  try {
    const alice = createWallet(), bob = createWallet();
    const tx = Transaction.create(alice, bob.address, 10, 0);   // alice has no coins
    assert.strictEqual((await call(n, '/tx', { tx })).status, 400);
    await call(n, '/mine', { miner: alice.address });
    const forged = JSON.parse(JSON.stringify(n.bc.latest)); forged.index = 2; forged.previousHash = n.bc.latest.hash; forged.hash = 'ff'.repeat(32);
    const r = await call(n, '/block', { block: forged });
    assert.strictEqual(r.body.status, 'rejected');
    assert.strictEqual(n.bc.chain.length, 2);
  } finally { await n.stop(); }
});

test('partitioned nodes fork, then the heavier chain wins after reconnect', async () => {
  const [a, b] = [createNode({ port: 4106, difficulty: 2 }), createNode({ port: 4107, difficulty: 2 })];
  await Promise.all([a.start(), b.start()]);
  try {
    const m1 = createWallet(), m2 = createWallet();
    await call(a, '/mine', { miner: m1.address });              // a: 2 blocks (not connected yet)
    await call(b, '/mine', { miner: m2.address }); await call(b, '/mine', { miner: m2.address }); // b: 3 blocks
    await call(a, '/peers', { url: b.url }); await settle();     // reconnect
    assert.strictEqual(a.bc.chain.length, 3);
    assert.strictEqual(a.bc.latest.hash, b.bc.latest.hash);
    assert.strictEqual(a.bc.balanceOf(m1.address), 0, "a's orphaned block reward vanished");
  } finally { await Promise.all([a.stop(), b.stop()]); }
});

test('a reorg on one node spreads to peers that were not directly reconnected', async () => {
  const [a, b, c] = [createNode({ port: 4108, difficulty: 2 }), createNode({ port: 4109, difficulty: 2 }), createNode({ port: 4110, difficulty: 2 })];
  await Promise.all([a.start(), b.start(), c.start()]);
  try {
    const m = createWallet();
    await call(b, '/peers', { url: a.url });                     // a - b connected, c isolated
    await call(a, '/mine', { miner: m.address }); await settle();
    await call(c, '/mine', { miner: m.address }); await call(c, '/mine', { miner: m.address }); await call(c, '/mine', { miner: m.address });
    await call(c, '/peers', { url: b.url }); await settle();     // only b is contacted
    for (const n of [a, b, c]) assert.strictEqual(n.bc.chain.length, 4);
    assert.strictEqual(a.bc.latest.hash, c.bc.latest.hash);
  } finally { await Promise.all([a.stop(), b.stop(), c.stop()]); }
});
