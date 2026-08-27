# CatPhish

Chrome extension that scans open Gmail and Outlook Web messages for phishing
signals using Gemini, and highlights the email and its individual links
directly in the page based on the AI's verdict.

## Setup

### Extension

```bash
npm install
npm run build      # one-off build
npm run watch       # rebuild on change
```

### Backend (required — powers all analysis)

```bash
cd backend
npm install
cp .env.example .env   # then fill in GEMINI_API_KEY (get one at aistudio.google.com/apikey)
npm run dev             # runs on http://localhost:8000
```

The extension has no local fallback — the backend must be running for any
analysis to appear. Without it, the banner shows "AI analysis unavailable."

> **Note:** `backend/.env` is gitignored and never committed — API keys are
> never shared through this repo. Everyone who runs CatPhish uses their own
> free Gemini key (a few minutes to get one, no cost on the free tier).

## Load in Chrome

1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select this project's root folder
4. Open Gmail (`mail.google.com`) or Outlook Web (`outlook.office.com` /
   `outlook.live.com` / `outlook.office365.com` / `outlook.cloud.microsoft`)
   and open any email

## What it does

- Extracts sender, subject, body, and links from the open email and sends
  them to the backend
- Gemini returns an overall verdict (safe / suspicious / dangerous) + score
  + explanation, **and** a per-link verdict for every link in the email
- The banner above the email shows the overall verdict, bolded
- Each link is highlighted in the page itself, colored by its own verdict —
  green (safe), yellow (suspicious), red (dangerous) — with the AI's reason
  in the link's tooltip

## Project layout

- `src/extractor.ts` — detects which mail client is open (by hostname) and
  dispatches to the matching extractor
- `src/extractors/gmail.ts` — reads sender/subject/body/links from Gmail's DOM
- `src/extractors/outlook.ts` — same, for Outlook Web's DOM
- `src/highlighter.ts` — renders the AI verdict banner and colors each link
  by its own flagged verdict
- `src/content.ts` — orchestrates extraction → AI request → rendering,
  watches for SPA navigation via `MutationObserver`
- `src/background.ts` — service worker; proxies the AI request to the backend
- `src/popup.ts` / `popup.html` — toolbar popup showing the last analysis
- `backend/src/server.ts` — single-endpoint Express server that calls the
  Gemini API and returns the structured verdict + per-link classifications

## Notes / known limits

- Gmail selectors (`span.gD`, `h2.hP`, `div.a3s`) target Gmail's current web
  UI; Gmail can change these without notice.
- Outlook Web has no equivalently stable, documented selectors — it's a
  frequently-changing React app. `src/extractors/outlook.ts` uses layered
  fallbacks (verified against a live mailbox on `outlook.cloud.microsoft`):
  body via `[data-test-id="MessageBodyContainer"]`, sender name via the
  persona-card's `aria-label="From: ..."` (the email address itself is often
  not in the DOM at all — Outlook loads it lazily behind a LivePersonaCard —
  so analysis proceeds on the display name alone when that happens). If a
  future Outlook redesign breaks this, that's the first place to check —
  inspect the reading pane's DOM and adjust the selectors there.
- The backend is meant for local demo use — CORS is wide open and there's no
  auth in front of it. Don't deploy it publicly as-is.
- Gemini's free tier has a small daily request quota per model. The backend
  retries transient errors and falls back from `gemini-flash-latest` to
  `gemini-flash-lite-latest` (a separate quota pool) automatically.
