# Big Tech News

A personal weekly digest of big tech news, automatically aggregated from major tech publications.

## 📡 What is this?

This project automatically scrapes and aggregates news from major tech publications (TechCrunch, The Verge, Ars Technica, CNBC, and many more) and creates weekly digests similar to [Big Tech Digest](https://bigtechdigest.com).

The site is:
- **Automatically updated** every Monday via GitHub Actions
- **Hosted for free** on GitHub Pages
- **Completely automated** - no manual intervention needed

## 🚀 Quick Start

### View the Site

The site is automatically deployed to GitHub Pages. After enabling Pages in your repository settings, it will be available at:

```
https://[your-username].github.io/BigTechNews/
```

### Manual Run

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the scraper (with backfill for past 4 weeks):
   ```bash
   npm run scrape:backfill
   ```
4. Build the static site:
   ```bash
   npm run build
   ```
5. Preview locally:
   ```bash
   npm run dev
   ```

## 🏗️ Project Structure

```
BigTechNews/
├── .github/
│   └── workflows/
│       └── weekly-digest.yml    # GitHub Actions workflow
├── build/
│   ├── generate.js              # Static site generator
│   └── templates/               # HTML templates
│       ├── index.html
│       ├── digest.html
│       └── styles.css
├── scraper/
│   ├── index.js                 # Main scraper logic
│   └── sources.js               # News sources configuration
├── data/                        # Generated JSON data
│   ├── index.json
│   └── digests/
│       └── week-X-YYYY.json
├── public/                      # Generated static site
│   ├── index.html
│   ├── week-X-YYYY.html
│   └── css/styles.css
└── package.json
```

## 📰 News Sources

The scraper aggregates from 20+ sources including:

| Category | Sources |
|----------|---------|
| General Tech | TechCrunch, The Verge, Engadget, Ars Technica, Wired |
| Business | CNBC Tech, Reuters Tech, Bloomberg Technology |
| AI | VentureBeat |
| Apple | 9to5Mac, MacRumors |
| Google | 9to5Google |
| EV/Auto | Electrek |
| Hardware | Tom's Hardware, The Register |
| Crypto | CoinDesk, Cointelegraph |
| Space | SpaceNews |
| Robotics | The Robot Report |

## ⚙️ Configuration

### Adjusting Sources

Edit `scraper/sources.js` to add or remove news sources. Each source needs:

```javascript
sourceName: {
  name: 'Display Name',
  rss: 'https://example.com/feed/',
  categories: ['ai', 'tech', 'etc']
}
```

### Filtering Keywords

The `BIG_TECH_KEYWORDS` array in `sources.js` determines which articles are considered "big tech" relevant. Add or remove keywords as needed.

### Categories

The `CATEGORIES` object defines how articles are grouped. Each category has a name and list of keywords for matching.

## 🔄 GitHub Actions

The workflow runs automatically every Monday at 8 AM UTC. You can also:

1. **Manual trigger**: Go to Actions → Weekly Big Tech News Digest → Run workflow
2. **Backfill**: When manually triggering, check "Backfill past 4 weeks" to regenerate older digests

### Setting up GitHub Pages

1. Go to your repository Settings
2. Navigate to Pages
3. Under "Build and deployment", select "GitHub Actions"
4. The workflow will automatically deploy on the next run

## 🛠️ Development

### Requirements

- Node.js 18+
- npm 9+

### Commands

| Command | Description |
|---------|-------------|
| `npm run scrape` | Scrape current week only |
| `npm run scrape:backfill` | Scrape past 4 weeks |
| `npm run build` | Generate static HTML |
| `npm run dev` | Start local preview server |

## 📝 License

MIT - This is for personal use. All article links point to their original sources.

## ⚠️ Disclaimer

This project aggregates RSS feeds for personal use. All article content remains on the original publishers' sites. Please respect the terms of service of each news source.
