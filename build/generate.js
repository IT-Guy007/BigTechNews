/**
 * Static Site Generator for Big Tech News
 * Generates homepage with week-to-date digest, search, and improved sidebar
 */

const fs = require('fs').promises;
const path = require('path');
const { CATEGORIES } = require('../scraper/sources');
const { startOfWeek, format, getISOWeek, getISOWeekYear } = require('date-fns');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

async function readTemplate(name) {
  return fs.readFile(path.join(TEMPLATES_DIR, `${name}.html`), 'utf-8');
}

function render(template, data) {
  // Handle simple conditionals {{#key}}...{{/key}}
  template = template.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return data[key] ? content.replace(/\{\{(\w+)\}\}/g, (__, k) => data[k] ?? '') : '';
  });
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
}

function esc(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(text, max) {
  if (!text) return '';
  const clean = text.replace(/<[^>]*>/g, '').trim();
  return clean.length <= max ? clean : clean.substring(0, max).trim() + '…';
}

function getIcon(article) {
  if (!article.category) return '📰';
  const cat = CATEGORIES[article.category];
  return cat?.icon || '📰';
}

/**
 * Generate top stories section - featured #1 story + secondary cards, no images
 */
function generateHeroHTML(articles) {
  if (!articles || articles.length === 0) {
    return '<div class="empty">No stories today</div>';
  }

  const main = articles[0];
  const secondary = articles.slice(1, 4);

  // Build keyword badges for lead story
  const mainKeywords = (main.matchedKeywords || []).slice(0, 3)
    .map(k => `<span class="top-badge">${esc(k)}</span>`).join('');

  let html = `
    <a href="${main.link}" target="_blank" rel="noopener" class="top-lead">
      <div class="top-lead-icon">${getIcon(main)}</div>
      <div class="top-lead-body">
        <div class="top-lead-meta">
          <span class="top-lead-source">${esc(main.source)}</span>
          ${main.relevanceScore ? `<span class="top-lead-score">Score ${main.relevanceScore}</span>` : ''}
        </div>
        <h1 class="top-lead-title">${esc(main.title)}</h1>
        <p class="top-lead-desc">${esc(truncate(main.description, 180))}</p>
        ${mainKeywords ? `<div class="top-badges">${mainKeywords}</div>` : ''}
      </div>
    </a>
    <div class="top-grid">
  `;

  for (const article of secondary) {
    const keywords = (article.matchedKeywords || []).slice(0, 2)
      .map(k => `<span class="top-badge">${esc(k)}</span>`).join('');

    html += `
      <a href="${article.link}" target="_blank" rel="noopener" class="top-card">
        <span class="top-card-icon">${getIcon(article)}</span>
        <div class="top-card-body">
          <h2 class="top-card-title">${esc(article.title)}</h2>
          <div class="top-card-meta">
            <span>${esc(article.source)}</span>
            ${keywords ? `<span class="top-card-badges">${keywords}</span>` : ''}
          </div>
        </div>
      </a>
    `;
  }

  html += '</div>';
  return html;
}

/**
 * Generate week-to-date items (aggregated top articles from current week's dailies)
 */
function generateWeekToDateHTML(articles, max = 8) {
  if (!articles || articles.length === 0) {
    return '<p class="empty">No articles this week yet</p>';
  }

  return articles.slice(0, max).map((article, i) => `
    <a href="${article.link}" target="_blank" rel="noopener" class="week-item">
      <span class="week-rank${i < 3 ? ' top' : ''}">${i + 1}</span>
      <div class="week-content">
        <h3 class="week-title">${esc(article.title)}</h3>
        <p class="week-meta">${esc(article.source)}${article.dayLabel ? ` · ${article.dayLabel}` : ''}</p>
      </div>
    </a>
  `).join('');
}

/**
 * Generate news list items
 */
function generateNewsListHTML(articles, max = 10) {
  if (!articles || articles.length === 0) {
    return '<div class="news-item"><div class="news-content"><p class="news-title">No articles</p></div></div>';
  }

  return articles.slice(0, max).map((article, i) => `
    <a href="${article.link}" target="_blank" rel="noopener" class="news-item">
      <span class="news-rank">${i + 1}</span>
      <div class="news-content">
        <h3 class="news-title">${esc(article.title)}</h3>
        <p class="news-meta">${esc(article.source)}</p>
      </div>
    </a>
  `).join('');
}

/**
 * Generate sidebar recent (last 5 daily digests)
 */
function generateSidebarRecentHTML(daily) {
  if (!daily || daily.length === 0) return '<li class="sidebar-item"><span class="sidebar-link">None</span></li>';
  
  return daily.slice(0, 5).map(item => `
    <li class="sidebar-item">
      <a href="daily/${item.id}.html" class="sidebar-link">
        <span>${esc(item.title)}</span>
        <span class="sidebar-link-meta">${item.totalArticles}</span>
      </a>
    </li>
  `).join('');
}

/**
 * Generate sidebar weekly/monthly with year grouping
 */
function generateSidebarGroupedHTML(items, type) {
  if (!items || items.length === 0) return '<li class="sidebar-item"><span class="sidebar-link">None</span></li>';
  
  // Group by year
  const byYear = {};
  for (const item of items.slice(0, 20)) {
    const year = item.year || (type === 'weekly' ? `20${item.id.split('-')[0]}` : `20${item.id.split('-')[0]}`);
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(item);
  }

  let html = '';
  for (const [year, yearItems] of Object.entries(byYear).sort((a, b) => b[0] - a[0])) {
    html += `<li class="sidebar-year">${year}</li>`;
    for (const item of yearItems.slice(0, 8)) {
      html += `
        <li class="sidebar-item">
          <a href="${type}/${item.id}.html" class="sidebar-link">
            <span>${esc(item.title)}</span>
            <span class="sidebar-link-meta">${item.totalArticles}</span>
          </a>
        </li>
      `;
    }
  }
  return html;
}

/**
 * Generate archive cards for each type
 */
function generateArchiveCardsHTML(items, type) {
  if (!items || items.length === 0) return '<div class="empty">No archives yet</div>';
  
  return `<div class="archive-grid">${items.slice(0, 12).map(item => `
    <a href="${type}/${item.id}.html" class="archive-card">
      <div>
        <div class="archive-title">${esc(item.title)}</div>
        <div class="archive-meta">${item.totalArticles} article${item.totalArticles !== 1 ? 's' : ''}${item.dateRange ? ` · ${item.dateRange}` : ''}</div>
      </div>
      <span class="archive-arrow">→</span>
    </a>
  `).join('')}</div>`;
}

/**
 * Collect week-to-date articles from daily digests
 */
async function getWeekToDateArticles(index) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const articles = [];
  const seenTitles = new Set();

  // Get all daily digests from this week
  for (const daily of index.daily) {
    // Parse date from id (YY-MM-DD)
    const [yy, mm, dd] = daily.id.split('-').map(Number);
    const digestDate = new Date(2000 + yy, mm - 1, dd);
    
    if (digestDate >= weekStart && digestDate <= now) {
      try {
        const digest = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'daily', `${daily.id}.json`), 'utf-8'));
        const dayLabel = format(digestDate, 'EEE');
        
        for (const article of (digest.highlights || []).slice(0, 5)) {
          // Deduplicate by title similarity
          const titleKey = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
          if (!seenTitles.has(titleKey)) {
            seenTitles.add(titleKey);
            articles.push({ ...article, dayLabel, digestDate });
          }
        }
      } catch {}
    }
  }

  // Sort by score (if available) then by date
  articles.sort((a, b) => {
    if (a.score !== b.score) return (b.score || 0) - (a.score || 0);
    return b.digestDate - a.digestDate;
  });

  return articles;
}

/**
 * Build search index from recent articles
 */
function buildSearchIndex(latestDaily, weekToDateArticles) {
  const articles = [];
  const seen = new Set();

  // Add today's articles
  for (const a of (latestDaily?.highlights || [])) {
    if (!seen.has(a.link)) {
      seen.add(a.link);
      articles.push({
        title: a.title,
        source: a.source,
        link: a.link,
        keywords: a.matchedKeywords || []
      });
    }
  }

  // Add week-to-date articles
  for (const a of weekToDateArticles) {
    if (!seen.has(a.link)) {
      seen.add(a.link);
      articles.push({
        title: a.title,
        source: a.source,
        link: a.link,
        keywords: a.matchedKeywords || []
      });
    }
  }

  return articles;
}

// Article HTML for digest page
function articleHTML(article, i) {
  const isTop = i < 3;
  return `
    <li class="article">
      <span class="article-num${isTop ? ' top' : ''}">${i + 1}</span>
      <div class="article-body">
        <div class="article-title"><a href="${article.link}" target="_blank" rel="noopener">${esc(article.title)}</a></div>
        <span class="article-source">${esc(article.source)}</span>
      </div>
    </li>`;
}

// More section by category
function moreHTML(byCategory) {
  const entries = Object.entries(byCategory || {})
    .filter(([_, articles]) => articles.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  if (entries.length === 0) return '<p class="empty">No additional articles.</p>';

  return entries.map(([key, articles]) => {
    const cat = CATEGORIES[key] || { name: key, icon: '📰' };
    const items = articles.slice(0, 5).map(a => 
      `<li class="more-item"><a href="${a.link}" target="_blank" rel="noopener">${esc(truncate(a.title, 80))}</a><span class="source">${esc(a.source)}</span></li>`
    ).join('');
    return `
      <div class="category">
        <div class="category-title">${cat.icon} ${esc(cat.name)} <span class="category-count">${articles.length}</span></div>
        <ul class="more-list">${items}</ul>
      </div>`;
  }).join('');
}

async function generateDigestPage(digest, type) {
  const template = await readTemplate('digest');
  const typeLabels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
  
  const highlightsHTML = digest.highlights?.length > 0
    ? digest.highlights.map((a, i) => articleHTML(a, i)).join('')
    : '<li class="empty">No highlights.</li>';

  return render(template, {
    title: digest.title,
    digestType: typeLabels[type] || 'Digest',
    dateRange: digest.dateRange,
    totalArticles: digest.totalArticles || 0,
    highlightCount: digest.highlights?.length || 0,
    highlightsHTML,
    moreHTML: moreHTML(digest.byCategory),
    generatedAt: new Date(digest.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  });
}

async function generateIndexPage(index, latestDaily, latestWeekly, weekToDateArticles) {
  const template = await readTemplate('index');
  
  const todayHighlights = latestDaily?.highlights || [];
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekDateRange = `${format(weekStart, 'MMM d')} – ${format(now, 'MMM d')}`;
  
  // Build search index
  const searchArticles = buildSearchIndex(latestDaily, weekToDateArticles);

  return render(template, {
    lastUpdated: new Date(index.lastUpdated).toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit'
    }),
    heroHTML: generateHeroHTML(todayHighlights),
    weekDateRange,
    weekToDateHTML: generateWeekToDateHTML(weekToDateArticles, 8),
    todayNewsHTML: generateNewsListHTML(todayHighlights.slice(4), 8),
    latestDailyLink: index.daily[0] ? `daily/${index.daily[0].id}.html` : '',
    latestWeeklyLink: index.weekly[0] ? `weekly/${index.weekly[0].id}.html` : '',
    sidebarRecentHTML: generateSidebarRecentHTML(index.daily),
    sidebarWeeklyHTML: generateSidebarGroupedHTML(index.weekly, 'weekly'),
    sidebarMonthlyHTML: generateSidebarGroupedHTML(index.monthly, 'monthly'),
    archiveDailyHTML: generateArchiveCardsHTML(index.daily, 'daily'),
    archiveWeeklyHTML: generateArchiveCardsHTML(index.weekly, 'weekly'),
    archiveMonthlyHTML: generateArchiveCardsHTML(index.monthly, 'monthly'),
    articlesJSON: JSON.stringify(searchArticles)
  });
}

async function build() {
  console.log('Building site...\n');

  // Create directories
  await fs.mkdir(path.join(PUBLIC_DIR, 'css'), { recursive: true });
  await fs.mkdir(path.join(PUBLIC_DIR, 'daily'), { recursive: true });
  await fs.mkdir(path.join(PUBLIC_DIR, 'weekly'), { recursive: true });
  await fs.mkdir(path.join(PUBLIC_DIR, 'monthly'), { recursive: true });

  // Copy CSS
  await fs.copyFile(path.join(TEMPLATES_DIR, 'styles.css'), path.join(PUBLIC_DIR, 'css', 'styles.css'));
  console.log('✓ styles.css');

  // Load index
  let index;
  try {
    index = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'index.json'), 'utf-8'));
  } catch {
    index = { lastUpdated: new Date().toISOString(), daily: [], weekly: [], monthly: [] };
  }

  // Load latest daily and weekly for homepage
  let latestDaily = null, latestWeekly = null;
  
  if (index.daily[0]) {
    try {
      latestDaily = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'daily', `${index.daily[0].id}.json`), 'utf-8'));
    } catch {}
  }
  
  if (index.weekly[0]) {
    try {
      latestWeekly = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'weekly', `${index.weekly[0].id}.json`), 'utf-8'));
    } catch {}
  }

  // Get week-to-date articles
  const weekToDateArticles = await getWeekToDateArticles(index);
  console.log(`✓ Week-to-date: ${weekToDateArticles.length} articles`);

  // Generate index
  await fs.writeFile(path.join(PUBLIC_DIR, 'index.html'), await generateIndexPage(index, latestDaily, latestWeekly, weekToDateArticles));
  console.log('✓ index.html');

  // Generate digest pages
  for (const type of ['daily', 'weekly', 'monthly']) {
    for (const info of index[type]) {
      try {
        const digest = JSON.parse(await fs.readFile(path.join(DATA_DIR, type, `${info.id}.json`), 'utf-8'));
        await fs.writeFile(path.join(PUBLIC_DIR, type, `${digest.id}.html`), await generateDigestPage(digest, type));
        console.log(`✓ ${type}/${digest.id}.html`);
      } catch (e) {
        console.error(`✗ ${type}/${info.id}: ${e.message}`);
      }
    }
  }

  console.log('\n✅ Done');
  process.exit(0);
}

build().catch(e => { console.error(e); process.exit(1); });
