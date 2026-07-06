# Digital Craft × GamLEARN — Service & Subscription Agreement

A single-page web contract that lets GamLEARN read, e-sign and submit the website & CRM service and subscription agreement. On signature, a PDF is generated client-side (so the signer's data never leaves their browser unverified), and a copy is emailed to both you and the signer via Resend.

## The deal this contract encodes

- **£249 / month** subscription — hosting, support, bug fixes and minor tweaks for the GamLEARN **website and CRM**.
- **12-month minimum term** from the date of signature, then rolls month-to-month (30 days notice to cancel).
- **Hybrid pricing for extra work** — bugs & minor tweaks included; small ad-hoc changes at **£50/hour**; larger features/new pages **fixed-quoted in writing first**.
- **Digital Craft retains ownership** of the website and CRM. GamLEARN is licensed to use them while subscribed. Taking full ownership is a **separate one-off purchase, quoted at the time** based on build size.

## What's in here

```
gamlearn-contract/
├── index.html         # The contract page (HTML/CSS/JS, single file)
├── api/
│   └── sign.js        # Vercel serverless function — receives PDF + emails it
├── assets/            # Logos + favicon
├── fonts/             # Arboria webfont
├── vercel.json
├── package.json
└── README.md
```

The contract page is fully self-contained — no build step. It uses `jsPDF` from a CDN to generate the signed PDF in the browser, then POSTs the base64 PDF to `/api/sign` for emailing.

---

## How it works

1. GamLEARN lands on the page, reads the agreement, fills in their details and signs on the canvas pad.
2. On submit, the browser builds a styled PDF including their data, signature image, and an audit trail (timestamp, IP, user agent).
3. The PDF is POSTed to `/api/sign` as base64.
4. The serverless function uses Resend to send the PDF to:
   - **You** (`NOTIFY_EMAIL`) with a full signature audit trail in the email body
   - **The signer** with a friendly confirmation
5. Both copies have the signed PDF as an attachment.
6. The success state on the page shows a download button so the client can grab the PDF immediately.

---

## Deploy

### 1. Resend account

- Sign up at [resend.com](https://resend.com) (free tier covers 100 emails/day).
- Add and verify your domain (`thedigicraft.co.uk`), then create an API key.

### 2. Push to a Git repo

```bash
git init            # if not already a repo
git add .
git commit -m "GamLEARN subscription contract"
gh repo create dc-gamlearn-contract --private --source=. --push
```

### 3. Deploy to Vercel

- Import the repo at [vercel.com/new](https://vercel.com/new). Framework preset: **Other**.
- **Environment variables**:
  | Name | Value |
  |---|---|
  | `RESEND_API_KEY` | Your Resend API key |
  | `FROM_EMAIL` | `contracts@thedigicraft.co.uk` (any address on your verified domain) |
  | `NOTIFY_EMAIL` | Where signed contracts should be sent to you |
- Deploy.

### 4. Custom domain (optional)

Add e.g. `contract.thedigicraft.co.uk` in Project Settings → Domains.

### 5. Test before sending

- Open the live URL, fill it in with your own details (use a different email than `NOTIFY_EMAIL`), sign and submit.
- You should receive **two emails**; check the PDF attachment renders correctly.

---

## Editing the contract content

All the contract text lives in `index.html`, section by section (`<!-- 1. The Service -->` … `<!-- 8. Signature Section -->`). Edit in place — no build step. Commit and push; Vercel redeploys automatically.

**Important footgun:** the PDF version is built in JavaScript inside `index.html` — search for `function buildPdf`. If you change the on-page wording, **update the matching `clauseHeading` / `clauseBody` calls too** so the PDF stays in sync.

---

## Logos

- `assets/DG - LOGO AND TEXT - BLACK - NO BG.png` — Digital Craft (provider)
- `assets/gamlearn-logo.png` — GamLEARN (client)

Both appear in the top brand strip and in the generated PDF header.

---

## Things this setup does NOT do

- **No identity verification.** Anyone with the link can sign. Fine for a known client; for higher stakes use DocuSign/PandaDoc.
- **No tamper-proof storage.** The signed PDF is emailed but not stored in an immutable ledger.
- **No counter-signature flow.** Only the client signs; Digital Craft is assumed to have accepted.

---

## Local development

```bash
npm install -g vercel
vercel link
vercel env pull .env.local
vercel dev     # runs at http://localhost:3000
```
