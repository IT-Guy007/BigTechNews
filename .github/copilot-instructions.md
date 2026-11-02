# Big Tech News - Copilot Instructions

A curated big tech news aggregator that scrapes RSS feeds, scores articles by relevance, and generates a static site with daily/weekly/monthly digests.

## Architecture Overview

```
scraper/           → RSS fetching, relevance scoring, digest generation
  ├── index.js     → Main scraper CLI (--daily, --weekly, --monthly, --backfill)
  └── sources.js   → RSS feeds config, keywords, and category definitions
data/              → JSON digests (daily/, weekly/, monthly/, index.json)
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

CI runs daily at 6:30 UTC via [.github/workflows/daily-digest.yml](.github/workflows/daily-digest.yml). Weekly digests auto-run on Mondays, monthly on the 1st.

## Relevance Scoring System

Articles are scored in [scraper/index.js](../scraper/index.js) using keywords from [scraper/sources.js](../scraper/sources.js):

- **+3 points**: `HIGH_IMPACT_KEYWORDS` (openai, acquisition, antitrust, ceo names, etc.)
- **+2 points**: `BIG_TECH_COMPANIES` (google, nvidia, anthropic, etc.)
- **+1 point**: `RELEVANT_TOPICS` (semiconductor, llm, robotaxi, etc.)
- **Excluded**: `EXCLUDED_PATTERNS` regex (deals, reviews, how-to, clickbait)
- **Minimum score**: 3 (defined as `MIN_RELEVANCE_SCORE`)

## Adding New Sources

Edit [scraper/sources.js](../scraper/sources.js):
```javascript
SOURCES.newsourcename = {
  name: 'Display Name',
  rss: 'https://example.com/feed.xml',
  priority: 2  // 1=high priority, 2=normal, 3=low
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
  "highlights": [{ "title", "link", "source", "score", "image", "matchedKeywords" }],
  "byCategory": { "ai": [...], "chips": [...] }
}
```

## Conventions

- **Date IDs**: `YY-MM-DD` for daily, `YY-W` for weekly, `YY-MM` for monthly
- **All HTML is escaped** via `esc()` helper—always use it for user content
- **Images extracted** from RSS enclosures, media:content, or parsed from HTML content
- **Categories** defined in `CATEGORIES` object with icons (🤖, 💾, etc.)
