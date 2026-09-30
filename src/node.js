'use strict';
// A MiniChain peer. Each node keeps its own full copy of the chain, validates
// everything it receives, gossips transactions and blocks, and resolves forks
// by adopting the valid chain with the most cumulative work.
const http = require('http');
const { Blockchain, Block, Transaction } = require('./blockchain');

function createNode({ port, difficulty = 3, reward = 50 }) {
  const url = `http://localhost:${port}`;
  const bc = new Blockchain({ difficulty, reward });
  const peers = new Set();

  const post = (peer, path, body) =>
    fetch(peer + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);

  const gossip = (path, body, except) => Promise.all([...peers].filter((p) => p !== except).map((p) => post(p, path, body)));

  async function syncFrom(peer) {
    const res = await fetch(peer + '/chain').catch(() => null);
    if (!res) return { replaced: false, reason: 'peer unreachable' };
    const { chain } = await res.json();
    return bc.replaceChain(chain);
  }

  const routes = {
    'GET /chain': () => ({ chain: bc.chain, mempool: bc.mempool }),
    'GET /peers': () => ({ url, peers: [...peers] }),
    'POST /peers': async ({ url: peer }) => {
      if (peer === url) return { peers: [...peers] };
      const isNew = !peers.has(peer);
      peers.add(peer);
      if (isNew) {
        await post(peer, '/peers', { url });          // introduce ourselves, then catch up
        const r = await syncFrom(peer);
        if (r.replaced) await gossip('/block', { block: bc.latest, from: url }, peer); // tell our other peers
      }
      return { peers: [...peers] };
    },
    'POST /tx': async ({ tx }) => {
      const added = bc.addTransaction(tx);   // throws on invalid or duplicate => not re-gossiped
      gossip('/tx', { tx: added });
      return { accepted: added.id };
    },
    'POST /block': async ({ block, from }) => {
      const b = new Block(block);
      if (bc.chain.some((x) => x.hash === b.hash)) return { status: 'known' };
      if (b.index === bc.chain.length && b.previousHash === bc.latest.hash) {
        const r = bc.replaceChain([...bc.chain, b]);
        if (r.replaced) { gossip('/block', { block: b, from: url }, from); return { status: 'appended' }; }
        return { status: 'rejected', reason: r.reason };
      }
      // Different history: ask the sender for their whole chain and apply the fork rule.
      const r = from ? await syncFrom(from) : { replaced: false, reason: 'unknown sender' };
      if (r.replaced) gossip('/block', { block: bc.latest, from: url }, from);
      return { status: r.replaced ? 'reorganised' : 'rejected', reason: r.reason };
    },
    'POST /mine': async ({ miner }) => {
      const b = bc.minePending(miner);
      gossip('/block', { block: b, from: url });
      return { mined: b.index, hash: b.hash };
    },
  };

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', async () => {
      const h = routes[`${req.method} ${req.url}`];
      const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
      if (!h) return send(404, { error: 'not found' });
      try { send(200, await h(raw ? JSON.parse(raw) : {})); } catch (e) { send(400, { error: e.message }); }
    });
  });

  return {
    url, bc, peers,
    start: () => new Promise((r) => server.listen(port, r)),
    stop: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
  };
}

module.exports = { createNode };

if (require.main === module) {
  // usage: node src/node.js <port> [peerUrl ...]
  const [port, ...peerUrls] = process.argv.slice(2);
  const node = createNode({ port: Number(port) || 4001 });
  node.start().then(async () => {
    console.log(`MiniChain node listening on ${node.url}`);
    for (const p of peerUrls) await fetch(node.url + '/peers', { method: 'POST', body: JSON.stringify({ url: p }) });
  });
}
