# Big Tech News - Copilot Instructions

A curated big tech news aggregator that scrapes RSS feeds, scores articles by relevance, and generates a static site with daily/weekly/monthly digests.

## Architecture Overview

```
scraper/           → RSS fetching, relevance scoring, digest generation
  ├── index.js     → Main scraper CLI (--daily, --weekly, --monthly, --backfill)
  └── sources.js   → RSS feeds config, keywords, and category definitions
data/              → JSON digests — a git worktree of the `data` branch, NOT part of main
                     (daily/, weekly/, monthly/, index.json, feed-health.json)
scripts/
  ├── feed-issues.js         → opens/closes GitHub issues for failing feeds
  └── migrate-data-branch.sh → one-time move of data/ from main to the data branch
tests/             → node:test regression tests (npm test)
build/
  ├── generate.js  → Static site generator using custom {{template}} system
  └── templates/   → layout.html (shared page shell), styles.css, site.js, search.js
public/            → Generated static site (deployed to GitHub Pages):
                     index.html, search.html, archive.html, daily|weekly|monthly/*.html,
                     search-index.json (every unique article, loaded by search.html)
```

## Key Workflows

| Task | Command |
|------|---------|
| Daily scrape | `npm run scrape` or `npm run scrape:daily` |
| Weekly digest | `npm run scrape:weekly` |
| Monthly digest | `npm run scrape:monthly` |
| Backfill history | `npm run scrape:backfill` (default 4 weeks) |
| Build site | `npm run build` |
| Local preview | `npm run dev` (serves on port 3000) |

CI scrapes every 2 hours via [.github/workflows/daily-digest.yml](.github/workflows/daily-digest.yml). Each run merges new articles into today's and yesterday's daily files (deduplicated by link and by story), then rebuilds last week's and last month's digests **from the daily files** (RSS feeds only hold hours to days of history, so weekly/monthly must never be built from a live fetch).

| Maintenance | Command |
|------|---------|
| Rebuild all weekly/monthly from daily files | `npm run scrape:rebuild` |
| Re-score + re-categorize all stored daily files (then rebuild) | `npm run scrape:rescore` |

Feed status (items, errors, last success, consecutive failures) is written to `data/feed-health.json` on every run; `scripts/feed-issues.js` opens an issue labelled `feed-health` after 12 consecutive failures and closes it on recovery.

Data lives on the `data` branch. CI checks it out into `./data` and pushes there; locally run `npm run data:checkout` once. Never commit data to main.

**Tests:** `npm test` runs `tests/*.test.js` (also in CI on every push/PR). When you change keywords, patterns or categories in `sources.js`, add the headline that motivated the change as a test case.

## Relevance Scoring System

Articles are scored in [scraper/index.js](../scraper/index.js) using keywords from [scraper/sources.js](../scraper/sources.js):

All keywords match as **whole words** (plural/possessive allowed): `ai` never matches "said", `intel` never matches "intelligence".

- **+3 points**: `HIGH_IMPACT_KEYWORDS` (openai, acquisition, antitrust, CEO names, etc.)
- **+2 points**: `BIG_TECH_COMPANIES` in the description, **+4** in the title
- **+1 point**: `RELEVANT_TOPICS` (semiconductor, llm, robotaxi, etc.); +1 for priority-1 sources
- **+1 per extra outlet** covering the same story (max +3); duplicates are listed in `alsoIn`
- **−4**: `PENALIZED_PATTERNS` (minor updates, clickbait)
- **Excluded**: `EXCLUDED_PATTERNS` (shopping deals, reviews, how-to, puzzles). Business deals are not excluded.
- **General feeds** (`general: true`) only count items naming a tracked company or high-impact keyword
- **Official newsrooms** (`company: 'openai'`) are credited with their company
- **Minimum score**: 3 (`MIN_RELEVANCE_SCORE`)

Categories: highest keyword total wins (title ×2); ties go to the earlier category in `CATEGORIES`; no match → `other`.

## Adding New Sources

Edit [scraper/sources.js](../scraper/sources.js):
```javascript
SOURCES.newsourcename = {
  name: 'Display Name',
  rss: 'https://example.com/feed.xml',
  priority: 2,      // 1=high priority, 2=normal, 3=low
  group: 'tech',    // for docs / feed health
  // general: true,  // broad feed: require a tracked company
  // company: 'acme' // official newsroom: credit this company
  // paywall: true,  // show a Paywall badge (and a free alternative when one exists)
  // lang: 'nl',     // non-English feed: show a language badge
};
```

## Template System

Templates in [build/templates/](../build/templates/) use simple mustache-like syntax:
- `{{variable}}` - Value substitution
- `{{#key}}...{{/key}}` - Conditional blocks (shows content if key is truthy)

Every page renders through `layout.html`; page bodies are built in `generate.js` (`generateIndexPage()`, `generateDigestPage()`, `generateArchivePage()`, `generateSearchPage()`). Search runs client-side in `templates/search.js` with whole-word matching and URL params (`q`, `cat`, `src`, `range`, `from`, `to`, `sort`).

## Data Format

Digest JSON structure (see [data/daily/](../data/daily/) for examples):
```json
{
  "id": "26-02-05",
  "title": "Thursday, Feb 5",
  "highlights": [{ "title", "link", "source", "published", "relevanceScore", "baseScore", "category", "matchedKeywords", "alsoIn": [{ "source", "title", "link" }] }],
  "byCategory": { "ai": [...], "chips_cloud": [...], "other": [...] },  // every article, incl. highlights
  "totalArticles": 86
}
```

## Conventions

- **Date IDs**: `YY-MM-DD` for daily, `YY-W` for weekly, `YY-MM` for monthly
- **All HTML is escaped** via `esc()` helper—always use it for user content
- **Images extracted** from RSS enclosures, media:content, or parsed from HTML content
- **Categories** defined in `CATEGORIES`; site labels in `CATEGORY_LABELS` (build/generate.js) — keep them in sync (a test checks this)
- **New since last visit**: elements with `data-published` get a "New" badge from `templates/site.js` (localStorage, 30-minute visit window)
