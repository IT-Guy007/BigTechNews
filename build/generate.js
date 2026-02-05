/**
 * Static Site Generator for Big Tech News
 * Generates HTML pages from digest JSON data
 */

const fs = require('fs').promises;
const path = require('path');
const { CATEGORIES } = require('../scraper/sources');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

/**
 * Read template file
 */
async function readTemplate(name) {
  const filepath = path.join(TEMPLATES_DIR, `${name}.html`);
  return fs.readFile(filepath, 'utf-8');
}

/**
 * Simple template engine
 */
function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Truncate text
 */
function truncate(text, maxLength) {
  if (!text) return '';
  const cleaned = text.replace(/<[^>]*>/g, '').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength).trim() + '...';
}

/**
 * Generate highlight HTML
 */
function generateHighlightHTML(highlight, index) {
  const tags = highlight.matchedKeywords?.slice(0, 3).map(k => 
    `<span class="highlight-tag">${escapeHtml(k)}</span>`
  ).join('') || '';
  
  return `
    <article class="highlight-item">
      <div class="highlight-rank">${index + 1}</div>
      <div class="highlight-content">
        <h3><a href="${highlight.link}" target="_blank" rel="noopener">${escapeHtml(highlight.title)}</a></h3>
        <p class="highlight-description">${escapeHtml(truncate(highlight.description, 180))}</p>
        <div class="highlight-meta">
          <span class="highlight-source">${escapeHtml(highlight.source)}</span>
          <div class="highlight-tags">${tags}</div>
        </div>
      </div>
    </article>
  `;
}

/**
 * Generate category section HTML
 */
function generateCategoryHTML(categoryKey, articles) {
  const category = CATEGORIES[categoryKey];
  if (!category) return '';
  
  const articlesList = articles.slice(0, 6).map(article => `
    <li class="category-article">
      <a href="${article.link}" target="_blank" rel="noopener">${escapeHtml(article.source)}</a>
      ${escapeHtml(truncate(article.title, 70))}
    </li>
  `).join('');

  return `
    <div class="category-section">
      <div class="category-header">
        <span class="category-icon">${category.icon || '📰'}</span>
        <span class="category-name">${escapeHtml(category.name)}</span>
        <span class="category-count">${articles.length}</span>
      </div>
      <ul class="category-list">
        ${articlesList}
      </ul>
    </div>
  `;
}

/**
 * Generate digest page HTML
 */
async function generateDigestPage(digest) {
  const template = await readTemplate('digest');
  
  const highlightsHTML = digest.highlights?.length > 0 
    ? digest.highlights.map((h, i) => generateHighlightHTML(h, i)).join('')
    : '<div class="empty-state"><p>No highlights available for this week.</p></div>';

  const categoriesHTML = Object.entries(digest.byCategory || {})
    .filter(([_, articles]) => articles.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([key, articles]) => generateCategoryHTML(key, articles))
    .join('');

  const html = render(template, {
    title: digest.title,
    dateRange: digest.dateRange,
    totalArticles: digest.totalArticles || 0,
    highlightCount: digest.highlights?.length || 0,
    highlightsHTML: highlightsHTML,
    categoriesHTML: categoriesHTML || '<div class="empty-state"><p>No additional articles.</p></div>',
    generatedAt: new Date(digest.generatedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  });

  return html;
}

/**
 * Generate index page HTML
 */
async function generateIndexPage(index) {
  const template = await readTemplate('index');
  
  const digestsListHTML = index.digests.map(digest => `
    <a href="${digest.id}.html" class="digest-card">
      <div class="digest-week">${escapeHtml(digest.title)}</div>
      <div class="digest-date">${escapeHtml(digest.dateRange)}</div>
      <div class="digest-stats">
        <span class="digest-stat">${digest.highlightCount || 0} highlights</span>
        <span class="digest-stat">${digest.totalArticles} total</span>
      </div>
    </a>
  `).join('');

  const latestDigest = index.digests[0];
  const latestSummary = latestDigest ? `
    <div class="latest-digest">
      <h2>${escapeHtml(latestDigest.title)}</h2>
      <p>${escapeHtml(latestDigest.dateRange)} · ${latestDigest.totalArticles} articles curated</p>
      <a href="${latestDigest.id}.html" class="btn-primary">Read Latest Digest →</a>
    </div>
  ` : '<div class="empty-state"><p>No digests available yet. Run the scraper to generate content.</p></div>';

  const html = render(template, {
    lastUpdated: new Date(index.lastUpdated).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    digestsListHTML: digestsListHTML || '<div class="empty-state"><p>No digests available.</p></div>',
    latestSummary: latestSummary,
    totalDigests: index.digests.length
  });

  return html;
}

/**
 * Main build function
 */
async function build() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║     Big Tech News Site Generator       ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Ensure public directory exists
  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  // Copy static assets
  try {
    await fs.mkdir(path.join(PUBLIC_DIR, 'css'), { recursive: true });
    const cssSource = path.join(TEMPLATES_DIR, 'styles.css');
    const cssDest = path.join(PUBLIC_DIR, 'css', 'styles.css');
    await fs.copyFile(cssSource, cssDest);
    console.log('✓ Copied styles.css');
  } catch (error) {
    console.error('✗ Error copying CSS:', error.message);
  }

  // Read index
  let index;
  try {
    const indexContent = await fs.readFile(path.join(DATA_DIR, 'index.json'), 'utf-8');
    index = JSON.parse(indexContent);
    console.log(`✓ Loaded index with ${index.digests.length} digests`);
  } catch (error) {
    console.log('⚠ No index.json found, creating empty index');
    index = { lastUpdated: new Date().toISOString(), digests: [] };
  }

  // Generate index page
  const indexHTML = await generateIndexPage(index);
  await fs.writeFile(path.join(PUBLIC_DIR, 'index.html'), indexHTML);
  console.log('✓ Generated index.html');

  // Generate individual digest pages
  for (const digestInfo of index.digests) {
    try {
      const digestPath = path.join(DATA_DIR, 'digests', `${digestInfo.id}.json`);
      const digestContent = await fs.readFile(digestPath, 'utf-8');
      const digest = JSON.parse(digestContent);

      const pageHTML = await generateDigestPage(digest);
      await fs.writeFile(path.join(PUBLIC_DIR, `${digestInfo.id}.html`), pageHTML);
      console.log(`✓ Generated ${digestInfo.id}.html`);
    } catch (error) {
      console.error(`✗ Error generating ${digestInfo.id}:`, error.message);
    }
  }

  console.log('\n✅ Build completed successfully!\n');
}

// Run build
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
