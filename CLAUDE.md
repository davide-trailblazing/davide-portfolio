# Claude operating rules for this repo

Condensed from Davide Dantonio's standing instructions (global `CLAUDE.md` + memory). Read this before making changes here. This is the portable subset that matters for any repo/site/Worker Claude builds for him; full detail lives in his personal config.

## Writing & voice
- Never use em dashes. Use a comma, period, colon, or hyphen instead.
- Be concise and direct: state the one big idea first, answer the exact question, cut filler ("here's the thing", "let's dive in"), no buzzwords (leverage, seamless, robust).
- Never invent a number, date, or fact. If a real source doesn't have it, say so instead of guessing.

## UI/UX defaults (anything with a screen)
- Every password/passphrase/login field gets a Show/Hide toggle so it can be checked while typing.
- Every icon-only button gets a visible text label next to the icon (e.g. "🔄 Refresh"), not just a hover tooltip.
- Status badges/buttons use real color, never flat gray: green = done/confirmed, blue = draft ready, gold = waiting, red = closed/declined.
- Any button that triggers a send (email, message, reply) opens the draft for review first. Never fire the send directly from a one-click button.
- Content pages/hubs/dashboards get an in-place editing suite: drag-to-reorder, undo/redo, autosave with no Save button, reset-to-original.
- Lists of tools/links/items show a real screenshot thumbnail plus the full URL or file title next to each entry, so each is recognizable without clicking through.

## AI features
- Cascade AI calls Gemini -> Groq -> Cloudflare Workers AI. Each tier's function throws on a missing key or failed call so the next tier picks it up automatically. Never require manual engine switching.
- Set `thinkingConfig.thinkingBudget: 0` on Gemini calls for latency-sensitive features (coaching, Q&A); otherwise thinking tokens can silently eat the output budget and truncate the answer.

## Deploys & infra
- This repo auto-deploys via Cloudflare Workers Builds on push to `main`. Don't hand-run `wrangler deploy` unless the auto-build is actually broken.
- Never commit secrets, API keys, or passwords. Use Cloudflare secrets / environment bindings.
- Never force-push, hard-reset, delete a branch, or tear down a Worker/KV/D1/R2 resource without explicit confirmation.
- If a Worker, route, or domain gets renamed, keep the old URL alive alongside the new one until Davide confirms it can retire. Never let a live link go dead silently.

## Content this app generates for Davide
- Keep it skimmable: short bold-label bullets, examples on their own line, tables for comparisons.
- Give full URLs as clickable hyperlinks, never bare text or "click here."
- Google Docs/Sheets/Slides links go to edit mode (`/edit`), never view-only.

## Repo hygiene
- If this repo splits private data (rosters, emails) from a public-facing site, never let personal data leak into the public side.
- Don't destroy Davide's manual edits when a script regenerates a document. Capture what a human added and re-insert it after.
- When something breaks, fix the root cause. Don't disable a safety check or hook just to make an error go away.

## When in doubt
- Confirm before anything hard to reverse or visible to others (force-push, deleting data, publishing somewhere public).
- Otherwise, execute end to end rather than handing back a manual checklist. That's how Davide wants this to work.
