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

// Generate highlight article HTML (numbered list style like bigtechdigest)
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

// Generate "more" section by category
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

// Generate digest card for index
function digestCardHTML(digest, type) {
  return `
    <a href="${type}/${digest.id}.html" class="digest-item">
      <div>
        <div class="digest-title">${esc(digest.title)}</div>
        <div class="digest-meta">${digest.highlightCount} highlights · ${digest.totalArticles} total</div>
      </div>
      <span class="digest-arrow">→</span>
    </a>`;
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

async function generateIndexPage(index) {
  const template = await readTemplate('index');
  
  const dailyListHTML = index.daily.length > 0
    ? index.daily.map(d => digestCardHTML(d, 'daily')).join('')
    : '<p class="empty">No daily digests yet.</p>';

  const weeklyListHTML = index.weekly.length > 0
    ? index.weekly.map(d => digestCardHTML(d, 'weekly')).join('')
    : '<p class="empty">No weekly digests yet.</p>';

  const monthlyListHTML = index.monthly.length > 0
    ? index.monthly.map(d => digestCardHTML(d, 'monthly')).join('')
    : '<p class="empty">No monthly digests yet.</p>';

  return render(template, {
    lastUpdated: new Date(index.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    dailyListHTML,
    weeklyListHTML,
    monthlyListHTML
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

  // Generate index
  await fs.writeFile(path.join(PUBLIC_DIR, 'index.html'), await generateIndexPage(index));
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
