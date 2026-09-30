'use strict';
const { Blockchain, Transaction } = require('../src/blockchain');
const { createWallet } = require('../src/crypto');
const attacks = require('../src/attacks');

const h = (t) => console.log(`\n=== ${t} ===`);
const short = (a) => a.slice(0, 8);

const alice = createWallet(), bob = createWallet(), carol = createWallet(), miner = createWallet(), eve = createWallet();
const bc = new Blockchain({ difficulty: 4, reward: 50 });

h('1. Mining & signed transactions');
bc.minePending(alice.address);
bc.addTransaction(Transaction.create(alice, bob.address, 20, bc.nextNonce(alice.address)));
bc.addTransaction(Transaction.create(alice, carol.address, 10, bc.nextNonce(alice.address), 3)); // fee 3 goes to the miner
const b = bc.minePending(miner.address);
console.log(`block #${b.index} hash ${b.hash.slice(0, 16)}… nonce ${b.nonce} (${b.transactions.length} txs)`);
for (const [n, w] of Object.entries({ alice, bob, carol, miner })) console.log(`${n.padEnd(6)} ${short(w.address)}  balance ${bc.balanceOf(w.address)}`);
console.log('chain valid:', bc.isValid());

h('2. Double-spend attempt (alice has 20 left, tries to spend 15 twice)');
console.log(attacks.doubleSpend(bc, alice, bob.address, carol.address, 15));

h('3. Forged transaction (eve signs as alice)');
const forged = Transaction.create(eve, bob.address, 5, 0);
forged.from = alice.address;
try { bc.addTransaction(forged); } catch (e) { console.log('rejected:', e.message); }

h('4. Tampering with history (change 20 -> 2000 in block #2)');
bc.minePending(miner.address);
const snapshot = JSON.stringify(bc.chain);
attacks.tamper(bc, 2, 2000);
console.log('chain valid:', bc.isValid());
bc.chain = JSON.parse(snapshot).map((x) => new (require('../src/blockchain').Block)(x));

h('5. 51% attack (attacker erases the payment in block #2)');
const before = bc.balanceOf(bob.address);
console.log('bob balance before:', before, '| chain length:', bc.chain.length);
console.log('attacker with too little hash power (1 block):',
  attacks.fiftyOnePercent(bc, { forkFrom: 1, attackerBlocks: 1, attackerAddress: eve.address }));
console.log('attacker with majority (4 blocks):',
  attacks.fiftyOnePercent(bc, { forkFrom: 1, attackerBlocks: 4, attackerAddress: eve.address }));
console.log('bob balance after:', bc.balanceOf(bob.address), '<- payment reversed');
console.log('Mitigation: wait for more confirmations; higher difficulty / hash rate; checkpoints.');
