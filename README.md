# PhishGuard

Chrome extension that scans open Gmail messages for phishing signals and
highlights risky senders/links directly in the page. Combines instant
client-side rule checks with an optional AI second opinion from Gemini.

## Setup

### Extension

```bash
npm install
npm run build      # one-off build
npm run watch       # rebuild on change
```

### Backend (optional — powers the AI analysis)

```bash
cd backend
npm install
cp .env.example .env   # then fill in GEMINI_API_KEY (get one at aistudio.google.com/apikey)
npm run dev             # runs on http://localhost:8000
```

The extension works without the backend running — you just won't see the
AI analysis line, and the rule-based banner still renders instantly.

## Load in Chrome

1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select this project's root folder
4. Open Gmail (`mail.google.com`) and open any email

## What it checks

**Rule-based (instant, always on):**
- Sender display name impersonating a known brand
- Reply-To domain differing from the From domain
- Lookalike/typosquatted sender or link domains (edit-distance vs. known brands)
- Urgency/pressure language in the body
- Link text that doesn't match its actual destination
- Links to raw IP addresses, punycode domains, URL shorteners, HTTP (non-HTTPS),
  or unusually long subdomain chains

**AI-based (async, requires the backend):**
- Gemini reads the full email content and gives an independent verdict + score
  + one-line explanation, shown as a second line under the rule-based banner

## Project layout

- `src/rules.ts` — detection rules, produces `RuleFinding[]`
- `src/scorer.ts` — combines findings into a 0–100 score + verdict
- `src/extractor.ts` — reads sender/subject/body/links from Gmail's DOM
- `src/highlighter.ts` — injects the risk banner, AI section, and link highlights
- `src/content.ts` — orchestrates extraction → scoring → rendering → AI request,
  watches for Gmail's SPA navigation via `MutationObserver`
- `src/background.ts` — service worker; proxies the AI request to the backend
- `src/popup.ts` / `popup.html` — toolbar popup showing the last analysis
- `backend/src/server.ts` — single-endpoint Express server that calls the
  Gemini API and returns a structured verdict

## Notes / known limits (MVP scope)

- Selectors (`span.gD`, `h2.hP`, `div.a3s`) target Gmail's current web UI;
  Gmail can change these without notice.
- Reply-To isn't exposed in Gmail's default view, so that check only fires
  when it can be read from the DOM.
- The backend is meant for local demo use — CORS is wide open and there's no
  auth in front of it. Don't deploy it publicly as-is.
