"""Builds the 3-minute group presentation (6 slides, ~30s each).
Run from the project root:  python3 scripts/make_deck.py
Requires python-pptx. Screenshots come from assets/ (dashboard captured from `npm start`)."""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

OUT = "GP_41_Crypto_Transaction_System.pptx"   # GP_XX_Task_name in short_name
GROUP = "Group 41"
MEMBERS = [("EG/2021/4754", "Rathnayaka I.G.T.A"), ("EG/2021/4706", "Peiris P R S")]
REG = "  ·  ".join(i for i, _ in MEMBERS)
VIDEO = "https://youtu.be/AgEqoAu_OqE"
REPO = "github.com/TA-rathnayaka/minichain"

BG, CARD, INK, MUTE, ACC, ACC2, OK, BAD = (RGBColor(*c) for c in [(10,14,26),(19,26,46),(233,237,247),(133,146,176),(110,168,254),(167,139,250),(52,211,153),(248,113,113)])
prs = Presentation(); prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
TOTAL = 6

def slide(n, title, notes, kicker=None):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid(); s.background.fill.fore_color.rgb = BG
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333 * n / TOTAL), Inches(0.09))
    bar.fill.solid(); bar.fill.fore_color.rgb = ACC; bar.line.fill.background()
    if kicker: text(s, 0.7, 0.32, 8, 0.4, [kicker.upper()], 13, ACC, True)
    text(s, 0.7, 0.62, 12, 1, [title], 34, INK, True)
    text(s, 0.7, 7.02, 9, 0.35, [f"MiniChain  ·  EC8204  ·  {GROUP}  ·  {REG}"], 11, MUTE)
    text(s, 11.9, 7.02, 0.8, 0.35, [f"{n} / {TOTAL}"], 11, MUTE)
    s.notes_slide.notes_text_frame.text = notes
    return s

def text(s, x, y, w, h, lines, size=20, color=INK, bold=False):
    tf = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)).text_frame; tf.word_wrap = True
    for i, l in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = l; p.space_after = Pt(6)
        for r in p.runs: r.font.size = Pt(size); r.font.color.rgb = color; r.font.bold = bold
    return tf

def box(s, x, y, w, h, line=None, r=0.06):
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = CARD; sh.adjustments[0] = r
    if line: sh.line.color.rgb = line; sh.line.width = Pt(1.5)
    else: sh.line.fill.background()
    return sh

def card(s, x, y, w, h, head, body, hc=ACC, size=17, line=None):
    box(s, x, y, w, h, line)
    text(s, x+0.25, y+0.18, w-0.5, 0.5, [head], 20, hc, True)
    text(s, x+0.25, y+0.8, w-0.5, h-0.9, body, size, INK)

# 1 ── Title + submission details (project name / domain / application / video)
s = slide(1, "MiniChain", "0:00–0:20  Hello, we are Group 41, registration numbers EG/2021/4754 and EG/2021/4706. Our project is MiniChain, a cryptocurrency transaction system with an attack lab. The domain is blockchain and cyber security. The application: a from-scratch blockchain where users send signed payments, miners secure them with proof-of-work, and an attack lab shows how forgery, double spending, tampering and 51 percent attacks are stopped, or where they succeed.", "EC8204 Blockchain and Cyber Security · Group Project")
box(s, 7.9, 0.4, 4.7, 1.15, ACC, 0.15)
text(s, 8.1, 0.47, 4.3, 0.4, [f"{GROUP.upper()}  ·  INDEX NUMBERS"], 13, ACC, True)
text(s, 8.1, 0.8, 4.4, 0.7, [f"{i}  {n}" for i, n in MEMBERS], 16, INK, True)
rows = [("PROJECT NAME", "MiniChain – Cryptocurrency Transaction System with Attack Lab", ACC),
        ("DOMAIN", "Blockchain & Cyber Security  (Cryptocurrency · FinTech)", ACC),
        ("APPLICATION", "A from-scratch blockchain for signed coin transfers with proof-of-work mining, a peer-to-peer network and an attack lab that demonstrates – and defends against – forgery, double spending, replay, tampering and 51% attacks.", ACC),
        ("3 MIN VIDEO", "Watch the 3-minute presentation video on YouTube", OK)]
ys, hs = [1.75, 2.85, 3.95, 5.75], [0.95, 0.95, 1.6, 0.95]
for (lab, val, col), y, h in zip(rows, ys, hs):
    box(s, 0.7, y, 11.9, h, r=0.1)
    text(s, 0.95, y+0.2, 2.7, 0.5, [lab], 14, col, True)
    tf = text(s, 3.6, y+0.14, 8.8, h-0.2, [val], 20 if lab != "APPLICATION" else 17, INK, lab in ("PROJECT NAME", "DOMAIN"))
    if lab == "3 MIN VIDEO":
        r = tf.paragraphs[0].runs[0]; r.hyperlink.address = VIDEO; r.font.color.rgb = ACC; r.font.underline = True

# 2 ── Problem and blockchain solution
s = slide(2, "The problem: trusting a middleman with the ledger", "0:20–0:50  Today, a bank or payment company keeps the ledger, so we must trust it. History can be edited, payments can be forged, and the same money can be spent twice. A blockchain removes the middleman: every payment is signed by its owner, grouped into blocks that are linked by hashes, and secured by proof-of-work, so anyone can verify every coin.", "Problem → Solution")
card(s, 0.7, 1.9, 5.5, 4.6, "The problem", ["✕  One party keeps the ledger", "✕  History can be quietly edited", "✕  Payments can be forged or replayed", "✕  The same coin can be spent twice", "✕  Everyone must trust the operator"], BAD, 21, BAD)
text(s, 6.25, 3.7, 0.9, 1, ["→"], 54, ACC, True)
card(s, 7.2, 1.9, 5.4, 4.6, "Blockchain solution", ["✓  Signed transactions (ECDSA)", "✓  Hash-linked, tamper-evident blocks", "✓  Proof-of-work consensus", "✓  Nonce + balance stop replay and double spend", "✓  Anyone can verify every coin"], OK, 21, OK)

# 3 ── Design / implementation
s = slide(3, "How MiniChain works", "0:50–1:25  A wallet has a secp256k1 key pair; the address is a hash of the public key. It signs each payment with ECDSA, including a nonce and a fee. Nodes validate the signature, balance and nonce, then miners put pending payments into a block with a Merkle root and search for a nonce so the hash starts with zeros: that is proof-of-work. The miner earns a reward plus fees. Every block stores the previous block's hash, and three peers gossip blocks and pick the chain with the most work. It is all built from scratch in Node.js with no dependencies.", "Implementation")
steps = [("1  Wallet", ["secp256k1 key pair", "address = hash of public key"]), ("2  Sign", ["ECDSA signature", "nonce (anti-replay) + fee"]), ("3  Validate", ["signature ✓", "balance ✓   nonce ✓"]), ("4  Mine", ["Merkle root of payments", "proof-of-work", "reward + fees to miner"]), ("5  Chain", ["hash links to previous block", "most cumulative work wins"])]
for i, (h, b) in enumerate(steps):
    card(s, 0.55 + i*2.5, 1.9, 2.35, 3.3, h, b, ACC, 16)
    if i < 4: text(s, 2.86 + i*2.5, 3.2, 0.3, 0.6, ["›"], 30, ACC2, True)
box(s, 0.7, 5.55, 11.9, 1.1, r=0.15)
text(s, 1.0, 5.72, 11.4, 0.9, ["Built from scratch in Node.js · zero dependencies · fees & mining reward · 3-node peer-to-peer network with fork resolution · live web dashboard"], 18, MUTE)

# 4 ── Demo (real screenshots)
s = slide(4, "Live demo: send, mine, tamper", "1:25–2:10  This is the live dashboard. Alice sends coins to Bob and Carol; the payments wait in the mempool, then a miner seals them into block 2 and earns the reward plus fees. The chain is valid. Now the attack lab edits Alice's payment inside block 2 from 20 coins to 2000. The Merkle root no longer matches, so the dashboard flags the chain invalid at exactly block 2, and the link to the next block turns red.", "Demo")
for x, img, cap, col in [(0.7, "assets/dashboard_valid.png", "Signed payments mined into block #2: chain valid", OK), (6.85, "assets/dashboard_tampered.png", "Block #2 edited: chain invalid at block #2", BAD)]:
    s.shapes.add_picture(img, Inches(x), Inches(1.7), width=Inches(5.75))
    text(s, x, 6.5, 5.75, 0.4, [cap], 15, col, True)

# 5 ── Attack results + mitigation
s = slide(5, "Attack lab: results and mitigation", "2:10–2:40  We attacked our own chain. A forged sender, a double spend, a replayed payment and a tampered block are all rejected. Even a small 51 percent attacker fails because their fork has less work. But a majority attacker succeeds and rewrites history: this is the inherent limit of proof-of-work. To defend: wait for about six confirmations before treating a payment as final, raise the difficulty, add checkpoints so nodes will not reorganise past agreed blocks, or move to a consensus with finality such as proof of stake.", "Results")
rows = [("Forged sender", "Rejected", OK, "key must hash to the sender address"), ("Double spend", "Rejected", OK, "nonce already used / balance spent"), ("Replay", "Rejected", OK, "nonce already consumed"),
        ("Tamper with old block", "Detected at block #", OK, "Merkle root / hash / link breaks"), ("51%: small attacker", "Rejected", OK, "fork has less cumulative work"), ("51%: majority attacker", "SUCCEEDS", BAD, "history rewritten (the PoW limit)")]
for i, (a, r, c, why) in enumerate(rows):
    y = 1.6 + i*0.52
    text(s, 0.7, y, 3.9, 0.5, [a], 18, INK, True); text(s, 4.6, y, 2.9, 0.5, [r], 18, c, True); text(s, 7.4, y, 5.3, 0.5, [why], 16, MUTE)
text(s, 0.7, 4.8, 11.9, 0.5, ["How to defend against a 51% attack"], 21, OK, True)
for i, (h, b) in enumerate([("Wait for confirmations", "Treat a payment as final only after about 6 blocks are built on top of it."),
                            ("Raise the difficulty", "A higher hash rate makes it far more expensive to out-mine honest miners."),
                            ("Add checkpoints", "Nodes refuse to reorganise the chain past a block everyone has agreed on."),
                            ("Use proof-of-stake", "Attackers risk their own staked coins if they try to rewrite history.")]):
    x = 0.7 + i*3.02
    box(s, x, 5.35, 2.86, 1.55, OK, 0.08)
    text(s, x+0.15, 5.42, 2.6, 0.5, [h], 14, INK, True)
    text(s, x+0.15, 5.98, 2.6, 0.9, [b], 12, MUTE)

# 6 ── Conclusion and thanks
s = slide(6, "Conclusion", "2:40–3:00  In conclusion: MiniChain gives a tamper-evident ledger with signed, replay-proof payments, proof-of-work consensus and a working peer-to-peer network, and it shows honestly where the design breaks: a majority attacker. Future work is dynamic difficulty, authenticated peers, disk persistence and checkpoints. Thank you. The source code is on GitHub and the full video is on YouTube.", "Wrap-up")
text(s, 0.7, 1.75, 7.6, 3.6, ["✓  Tamper-evident ledger with signed, replay-proof payments", "✓  Proof-of-work consensus with fork resolution", "✓  Working 3-node peer-to-peer network with fees", "✓  Attacks demonstrated, including where the design breaks (51%)"], 21, INK)
box(s, 0.7, 4.75, 7.6, 1.9, r=0.1)
text(s, 0.95, 4.9, 7.1, 1.7, ["Limits & future work", "Dynamic difficulty · authenticated peers · disk persistence · checkpoints / PoS finality"], 17, MUTE)
box(s, 8.7, 1.75, 3.9, 4.9, ACC, 0.06)
text(s, 8.95, 2.05, 3.5, 1, ["Thank you"], 36, ACC, True)
lines = [GROUP]
for i, n in MEMBERS: lines += [n, i]
lines += ["", "GitHub: " + REPO.split("/", 1)[1], "Watch the presentation video"]
tf = text(s, 8.95, 3.1, 3.5, 3.4, lines, 14, INK)
r = tf.paragraphs[-1].runs[0]; r.hyperlink.address = VIDEO; r.font.color.rgb = ACC; r.font.underline = True
r = tf.paragraphs[-2].runs[0]; r.hyperlink.address = "https://" + REPO; r.font.color.rgb = ACC; r.font.underline = True

prs.save(OUT)
print("saved", OUT, "-", len(prs.slides._sldIdLst), "slides")
