'use strict';
// Demo node: REST API + dashboard. Wallets are held server-side for demo
// convenience only; a real client would sign locally and never share keys.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Blockchain, Block, Transaction } = require('./blockchain');
const { createWallet } = require('./crypto');
const attacks = require('./attacks');

const PORT = process.env.PORT || 3000;
let bc, wallets, backup = null;

function reset() {
  bc = new Blockchain({ difficulty: 4, reward: 50 });
  wallets = {};
  backup = null;
  for (const name of ['Alice', 'Bob', 'Carol', 'Miner']) wallets[name] = createWallet();
  bc.minePending(wallets.Alice.address);
}
reset();

const nameOf = (addr) => Object.keys(wallets).find((n) => wallets[n].address === addr) || addr.slice(0, 8);

function snapshot() {
  const { balances } = bc.state();
  return {
    difficulty: bc.difficulty, reward: bc.reward, validity: bc.isValid(),
    wallets: Object.entries(wallets).map(([name, w]) => ({ name, address: w.address, balance: balances[w.address] || 0 })),
    mempool: bc.mempool.map((t) => ({ id: t.id, from: nameOf(t.from), to: nameOf(t.to), amount: t.amount, fee: t.fee })),
    canRestore: !!backup,
    chain: bc.chain.map((b) => ({
      index: b.index, hash: b.hash, previousHash: b.previousHash, nonce: b.nonce, merkleRoot: b.merkleRoot,
      timestamp: b.timestamp,
      transactions: b.transactions.map((t) => ({ id: t.id, from: t.isCoinbase() ? 'REWARD' : nameOf(t.from), to: nameOf(t.to), amount: t.amount, fee: t.fee })),
    })),
  };
}

const routes = {
  'GET /api/state': () => snapshot(),
  'POST /api/reset': () => { reset(); return snapshot(); },
  'POST /api/send': ({ from, to, amount, fee }) => {
    const w = wallets[from];
    if (!w || !wallets[to]) throw new Error('unknown wallet');
    bc.addTransaction(Transaction.create(w, wallets[to].address, Number(amount), bc.nextNonce(w.address), Number(fee) || 0));
    return snapshot();
  },
  'POST /api/mine': () => { bc.minePending(wallets.Miner.address); return snapshot(); },
  'POST /api/tamper': ({ block, amount }) => {
    backup = backup || JSON.stringify(bc.chain);
    if (!attacks.tamper(bc, Number(block), Number(amount))) throw new Error('no transfer in that block');
    return snapshot();
  },
  'POST /api/restore': () => {
    if (!backup) throw new Error('nothing to restore');
    bc.chain = JSON.parse(backup).map((b) => new Block(b));
    backup = null;
    return snapshot();
  },
  'POST /api/attack51': ({ forkFrom, blocks }) => {
    const attacker = createWallet();
    wallets.Attacker = wallets.Attacker || attacker;
    const r = attacks.fiftyOnePercent(bc, { forkFrom: Number(forkFrom), attackerBlocks: Number(blocks), attackerAddress: wallets.Attacker.address });
    return { attack: r, ...snapshot() };
  },
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

http.createServer((req, res) => {
  const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
  const handler = routes[`${req.method} ${req.url.split('?')[0]}`];
  if (handler) {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { send(200, handler(raw ? JSON.parse(raw) : {})); } catch (e) { send(400, { error: e.message }); }
    });
    return;
  }
  const file = path.join(__dirname, '..', 'public', req.url === '/' ? 'index.html' : path.basename(req.url));
  fs.readFile(file, (err, data) => (err ? send(404, 'not found', 'text/plain') : send(200, data, MIME[path.extname(file)] || 'text/plain')));
}).listen(PORT, () => console.log(`MiniChain dashboard: http://localhost:${PORT}`));
