# Big Tech News

Curated big tech news ranked by relevance. Updated daily.

**Live site:** [IT-Guy007.github.io/BigTechNews](https://IT-Guy007.github.io/BigTechNews/)

## Updates

- **Daily** — feeds are scraped every 2 hours; each run adds new stories to today's digest
- **Weekly** — built from the daily digests once the week is over (ISO weeks, Monday–Sunday)
- **Monthly** — built from the daily digests once the month is over

## Sources

49 feeds, listed in [scraper/sources.js](scraper/sources.js):

- **Tech news:** TechCrunch, The Verge, Engadget, Ars Technica, Wired, Gizmodo, 404 Media, Euronews Next
- **Business:** CNBC (Tech + Top News), Bloomberg (Technology + Markets), WSJ Tech, The Information, SiliconANGLE
- **Aggregators:** Techmeme, Hacker News (200+ points)
- **AI:** MIT Technology Review, The Decoder
- **Apple, Google & mobile:** 9to5Mac, MacRumors, AppleInsider, 9to5Google, Android Authority, GSMArena
- **Chips & data centers:** Tom's Hardware, The Register, DataCenterDynamics, EE Times, ServeTheHome
- **EVs:** Electrek, InsideEVs, Teslarati
- **Space:** SpaceNews, Space.com
- **Asia & Europe:** Nikkei Asia, SCMP, TrendForce, heise online (German), Tweakers (Dutch)
- **Crypto:** CoinDesk, The Block, Decrypt
- **Official newsrooms:** OpenAI, Google, NVIDIA, Apple, Microsoft, Meta

Paywalled sources (Bloomberg, WSJ, The Information, Nikkei Asia) are marked on the site, with a link to a free outlet when one covered the same story. Non-English sources carry a language badge.

Feed status from the latest run is in `feed-health.json` on the `data` branch. A GitHub issue (label `feed-health`) opens automatically when a feed fails 12 runs in a row (24 hours) and closes when it recovers.

## Repository layout

- **`main`** — code: `scraper/`, `build/`, `scripts/`, `tests/`, workflows
- **`data`** — scraped content only (`daily/`, `weekly/`, `monthly/`, `index.json`, `feed-health.json`). The workflow checks it out into `./data` and commits there, so bot commits never touch `main`.

Local development:

```bash
npm ci
npm run data:checkout   # adds ./data as a worktree of the data branch (once)
npm run data:pull       # later: update ./data
npm test                # regression tests for scoring, filters, dedup, badges
npm run build && npm run dev
```
