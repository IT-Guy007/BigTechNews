/**
 * Static Site Generator for Big Tech News
 */

const fs = require('fs').promises;
const path = require('path');
const { CATEGORIES } = require('../scraper/sources');

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
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(text, max) {
  if (!text) return '';
  const clean = text.replace(/<[^>]*>/g, '').trim();
  return clean.length <= max ? clean : clean.substring(0, max).trim() + '…';
}

// Get a category icon for an article
function getIcon(article) {
  if (!article.category) return '📰';
  const cat = CATEGORIES[article.category];
  return cat?.icon || '📰';
}

// Generate hero section (top story + 2 secondary)
function generateHeroHTML(articles) {
  if (!articles || articles.length === 0) {
    return '<div class="empty">No stories today</div>';
  }

  const main = articles[0];
  const secondary = articles.slice(1, 3);

  let html = `
    <a href="${main.link}" target="_blank" rel="noopener" class="hero-main">
      <div class="hero-placeholder">${getIcon(main)}</div>
      <div class="hero-content">
        <span class="hero-tag">${esc(main.source)}</span>
        <h2 class="hero-title">${esc(main.title)}</h2>
        <p class="hero-meta">${main.matchedKeywords?.slice(0, 2).join(' · ') || ''}</p>
      </div>
    </a>
    <div class="hero-secondary">
  `;

  for (const article of secondary) {
    html += `
      <a href="${article.link}" target="_blank" rel="noopener" class="hero-card">
        <div class="hero-card-image">
          <div class="hero-card-placeholder">${getIcon(article)}</div>
        </div>
        <div class="hero-card-content">
          <h3 class="hero-card-title">${esc(article.title)}</h3>
          <p class="hero-card-meta">${esc(article.source)}</p>
        </div>
      </a>
    `;
  }

  html += '</div>';
  return html;
}

// Generate news grid items
function generateNewsGridHTML(articles, max = 6) {
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

// Generate sidebar links
function generateSidebarHTML(items, type, max = 5) {
  if (!items || items.length === 0) return '<li class="sidebar-item"><span class="sidebar-link">None</span></li>';
  
  return items.slice(0, max).map(item => `
    <li class="sidebar-item">
      <a href="${type}/${item.id}.html" class="sidebar-link">
        <span>${esc(item.title)}</span>
        <span class="sidebar-link-meta">${item.totalArticles}</span>
      </a>
    </li>
  `).join('');
}

// Generate archive cards
function generateArchiveHTML(daily, weekly, monthly) {
  let html = '';
  
  // Show recent daily
  for (const d of daily.slice(0, 3)) {
    html += `
      <a href="daily/${d.id}.html" class="archive-card">
        <div>
          <div class="archive-title">${esc(d.title)}</div>
          <div class="archive-meta">${d.totalArticles} articles</div>
        </div>
        <span class="archive-arrow">→</span>
      </a>
    `;
  }
  
  // Show recent weekly
  for (const w of weekly.slice(0, 2)) {
    html += `
      <a href="weekly/${w.id}.html" class="archive-card">
        <div>
          <div class="archive-title">${esc(w.title)}</div>
          <div class="archive-meta">${w.totalArticles} articles</div>
        </div>
        <span class="archive-arrow">→</span>
      </a>
    `;
  }
  
  // Show monthly
  for (const m of monthly.slice(0, 1)) {
    html += `
      <a href="monthly/${m.id}.html" class="archive-card">
        <div>
          <div class="archive-title">${esc(m.title)}</div>
          <div class="archive-meta">${m.totalArticles} articles</div>
        </div>
        <span class="archive-arrow">→</span>
      </a>
    `;
  }
  
  return html || '<div class="empty">No archives yet</div>';
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

async function generateIndexPage(index, latestDaily, latestWeekly) {
  const template = await readTemplate('index');
  
  // Get today's highlights for hero and grid
  const todayHighlights = latestDaily?.highlights || [];
  const weekHighlights = latestWeekly?.highlights || [];

  return render(template, {
    lastUpdated: new Date(index.lastUpdated).toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit'
    }),
    heroHTML: generateHeroHTML(todayHighlights),
    todayNewsHTML: generateNewsGridHTML(todayHighlights.slice(3), 6),
    weekNewsHTML: generateNewsGridHTML(weekHighlights, 6),
    latestDailyLink: index.daily[0] ? `daily/${index.daily[0].id}.html` : '',
    latestWeeklyLink: index.weekly[0] ? `weekly/${index.weekly[0].id}.html` : '',
    sidebarDailyHTML: generateSidebarHTML(index.daily, 'daily', 7),
    sidebarWeeklyHTML: generateSidebarHTML(index.weekly, 'weekly', 5),
    sidebarMonthlyHTML: generateSidebarHTML(index.monthly, 'monthly', 3),
    archiveHTML: generateArchiveHTML(index.daily, index.weekly, index.monthly)
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

  // Generate index
  await fs.writeFile(path.join(PUBLIC_DIR, 'index.html'), await generateIndexPage(index, latestDaily, latestWeekly));
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
