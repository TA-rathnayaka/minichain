from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

BG, CARD, INK, MUTE, ACC, OK, BAD = (RGBColor(*c) for c in [(15,20,32),(24,32,51),(232,236,245),(138,149,173),(96,165,250),(52,211,153),(248,113,113)])
prs = Presentation(); prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)

def slide(title, notes):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid(); s.background.fill.fore_color.rgb = BG
    tb = s.shapes.add_textbox(Inches(0.7), Inches(0.4), Inches(12), Inches(1)).text_frame
    tb.text = title; r = tb.paragraphs[0].runs[0]; r.font.size = Pt(36); r.font.bold = True; r.font.color.rgb = INK
    s.notes_slide.notes_text_frame.text = notes
    return s

def text(s, x, y, w, h, lines, size=20, color=INK, bold=False):
    tf = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)).text_frame; tf.word_wrap = True
    for i, l in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = l; p.space_after = Pt(8)
        for r in p.runs: r.font.size = Pt(size); r.font.color.rgb = color; r.font.bold = bold

def card(s, x, y, w, h, head, body, hc=ACC):
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = CARD; sh.line.fill.background(); sh.adjustments[0] = 0.06
    text(s, x+0.2, y+0.15, w-0.4, 0.6, [head], 20, hc, True)
    text(s, x+0.2, y+0.75, w-0.4, h-0.9, body, 16, INK)

# 1 title
s = slide("MiniChain", "Intro 15s: we built a cryptocurrency blockchain from scratch and attacked it ourselves.")
text(s, 0.7, 1.6, 12, 1, ["A cryptocurrency transaction system with an attack lab"], 28, ACC)
text(s, 0.7, 3.0, 12, 2, ["EC8204 Blockchain and Cyber Security – Group Project", "Group GP_XX  ·  members: EG/2021/xxxx, EG/2021/xxxx, EG/2021/xxxx, EG/2021/xxxx"], 20, MUTE)
# 2 problem
s = slide("Problem: trusting a middleman with the ledger", "Problem 30s: banks keep the ledger; if it is edited or a payment is copied, users must trust them. Blockchain removes that trust.")
card(s, 0.7, 1.7, 3.9, 4.2, "Central ledger", ["One party can edit history", "Single point of failure", "Users must trust the operator"], BAD)
card(s, 4.7, 1.7, 3.9, 4.2, "Threats", ["Forged payments", "Double spending", "Replayed transactions", "Rewriting past records"], BAD)
card(s, 8.7, 1.7, 3.9, 4.2, "Our goal", ["Anyone can verify every coin", "No trusted operator", "Prove attacks fail – and where they don't"], OK)
# 3 design
s = slide("Solution: how MiniChain works", "Design 45s: wallet signs, nonce+balance stop replay/double spend, miner packs txs into a block with a Merkle root, PoW seals it, each block links to previous hash.")
for i, (h, b) in enumerate([("1  Wallet", ["secp256k1 keys", "address = SHA-256(pubkey)"]), ("2  Sign", ["ECDSA signature", "nonce = anti-replay"]), ("3  Validate", ["signature ✔  balance ✔", "nonce ✔"]), ("4  Mine", ["Merkle root of txs", "reward + fees to miner", "proof-of-work"]), ("5  Chain", ["hash links to previous", "longest work wins"])]):
    card(s, 0.5 + i*2.5, 1.9, 2.35, 3.2, h, b)
text(s, 0.7, 5.6, 12, 1, ["Built from scratch in Node.js – zero dependencies · fees · 3-node network · 18 automated tests · live dashboard"], 20, MUTE)
# 4 attacks
s = slide("Attack lab: what we tried to break", "Attacks 45s: forged, double spend, replay, tamper all blocked. 51 percent succeeds only with majority work - the inherent PoW limit, so we recommend confirmations.")
rows = [("Forged sender", "Rejected", OK, "key must hash to address"), ("Double spend", "Rejected", OK, "nonce + balance"), ("Replay", "Rejected", OK, "nonce consumed"),
        ("Tamper old block", "Detected at block #", OK, "Merkle root / hash / link break"), ("51% – small attacker", "Rejected", OK, "less cumulative work"), ("51% – majority attacker", "SUCCEEDS", BAD, "history rewritten – PoW limit")]
for i, (a, r, c, why) in enumerate(rows):
    y = 1.6 + i*0.85
    text(s, 0.7, y, 4.2, 0.6, [a], 20, INK, True); text(s, 5.0, y, 3.2, 0.6, [r], 20, c, True); text(s, 8.2, y, 4.8, 0.6, [why], 18, MUTE)
# 4b network
s = slide("A real network, not one program", "Network 25s: three peers gossip transactions and blocks. We cut one off, both sides mined, then reconnected. The chain with more work won on every node, and orphaned payments went back to the mempool.")
card(s, 0.7, 1.7, 3.9, 4.2, "Gossip", ["Transactions and blocks spread peer to peer", "Every node re-validates everything", "Late joiners download and verify the chain"])
card(s, 4.7, 1.7, 3.9, 4.2, "Network split", ["Peer C cut off, mines 3 blocks", "Peers A + B mine 1 block", "Two competing histories"], BAD)
card(s, 8.7, 1.7, 3.9, 4.2, "Reconnect", ["Most cumulative work wins", "All nodes end on the same head hash", "Orphaned payments return to the mempool"], OK)
# 5 demo/results
s = slide("Demo & results", "Demo 40s: show dashboard - send coins, mine, tamper button turns block red, 51 percent button. Then npm test: 18 of 18 pass.")
card(s, 0.7, 1.7, 5.9, 3.6, "Live dashboard", ["Send signed coins, mine blocks", "Tamper button → chain turns invalid, faulty block highlighted", "51% button → fork replaces history"])
card(s, 6.8, 1.7, 5.8, 3.6, "Verification", ["18 / 18 tests pass", "Console demo of every scenario", "Mitigation: more confirmations, higher difficulty, checkpoints"], OK)
text(s, 0.7, 5.8, 12, 1, ["npm test   ·   npm run demo   ·   npm start"], 20, MUTE)
# 6 conclusion
s = slide("Conclusion", "Wrap 15s: blockchain gives verifiable integrity without a trusted operator; limits are honest - single node, fixed difficulty, no fees.")
text(s, 0.7, 1.7, 12, 3, ["✔  Tamper-evident ledger with signed, replay-proof transactions", "✔  Proof-of-work consensus with fork resolution", "✔  Attacks demonstrated – including where the design breaks (51%)", "Future work: peer-to-peer network, dynamic difficulty, fees, PoS"], 24)
prs.save("GP_XX_MiniChain_Crypto_Transactions.pptx")
