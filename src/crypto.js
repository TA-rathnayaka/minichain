'use strict';
const crypto = require('crypto');

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

// Wallet: secp256k1 key pair (same curve as Bitcoin/Ethereum).
// Address = first 40 hex chars of SHA-256(public key).
function createWallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
  const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex');
  return { publicKey: pub, privateKey: priv, address: addressOf(pub) };
}

const addressOf = (publicKeyHex) => sha256(publicKeyHex).slice(0, 40);

function sign(message, privateKeyHex) {
  const key = crypto.createPrivateKey({ key: Buffer.from(privateKeyHex, 'hex'), format: 'der', type: 'pkcs8' });
  return crypto.sign('sha256', Buffer.from(message), key).toString('hex');
}

function verify(message, signatureHex, publicKeyHex) {
  try {
    const key = crypto.createPublicKey({ key: Buffer.from(publicKeyHex, 'hex'), format: 'der', type: 'spki' });
    return crypto.verify('sha256', Buffer.from(message), key, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

// Merkle root over transaction ids; lets a block commit to all its transactions.
function merkleRoot(ids) {
  if (ids.length === 0) return sha256('');
  let level = ids.slice();
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(sha256(level[i] + (level[i + 1] || level[i])));
    }
    level = next;
  }
  return level[0];
}

module.exports = { sha256, createWallet, addressOf, sign, verify, merkleRoot };
