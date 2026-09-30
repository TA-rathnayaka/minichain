'use strict';
// Three MiniChain peers on localhost: gossip, block propagation, a network split, and fork resolution.
const { createNode } = require('../src/node');
const { Transaction } = require('../src/blockchain');
const { createWallet } = require('../src/crypto');

const call = (node, path, body) =>
  fetch(node.url + path, body ? { method: 'POST', body: JSON.stringify(body) } : {}).then((r) => r.json());
const settle = () => new Promise((r) => setTimeout(r, 400));
const step = (t) => console.log(`\n--- ${t}`);
const heads = (nodes) => nodes.map((n, i) => `${'ABC'[i]}: #${n.bc.latest.index} ${n.bc.latest.hash.slice(0, 10)}…`).join('   ');

(async () => {
  const A = createNode({ port: 4201, difficulty: 3 }), B = createNode({ port: 4202, difficulty: 3 }), C = createNode({ port: 4203, difficulty: 3 });
  const nodes = [A, B, C];
  await Promise.all(nodes.map((n) => n.start()));
  const alice = createWallet(), bob = createWallet(), minerB = createWallet(), minerC = createWallet();

  step('1. Connect nodes in a line: A - B - C');
  await call(B, '/peers', { url: A.url }); await call(C, '/peers', { url: B.url });
  console.log('A peers:', [...A.peers].length, ' B peers:', [...B.peers].length, ' C peers:', [...C.peers].length);

  step('2. Node A mines a block for alice; it reaches C through B');
  await call(A, '/mine', { miner: alice.address }); await settle();
  console.log(heads(nodes));

  step('3. Alice pays bob 15 (fee 2) at node A; the transaction spreads to every mempool');
  await call(A, '/tx', { tx: Transaction.create(alice, bob.address, 15, 0, 2) }); await settle();
  console.log('mempool sizes:', nodes.map((n) => n.bc.mempool.length).join(', '));

  step('4. Node B mines it; everyone agrees');
  await call(B, '/mine', { miner: minerB.address }); await settle();
  console.log(heads(nodes));
  console.log('bob balance on A/B/C:', nodes.map((n) => n.bc.balanceOf(bob.address)).join(' / '), '| miner B (reward+fee):', A.bc.balanceOf(minerB.address));

  step('5. Network split: C is cut off and mines 3 blocks on its own; A and B mine 1 block');
  B.peers.delete(C.url); C.peers.delete(B.url);
  await call(C, '/mine', { miner: minerC.address }); await call(C, '/mine', { miner: minerC.address }); await call(C, '/mine', { miner: minerC.address });
  await call(A, '/mine', { miner: alice.address }); await settle();
  console.log(heads(nodes), ' <- two competing histories');

  step('6. Reconnect: the chain with more total work wins on every node');
  await call(C, '/peers', { url: B.url }); await settle();
  console.log(heads(nodes));
  console.log('all nodes agree:', new Set(nodes.map((n) => n.bc.latest.hash)).size === 1);
  console.log("A's orphaned block was discarded; its transactions return to the mempool if still valid.");

  await Promise.all(nodes.map((n) => n.stop()));
})();
