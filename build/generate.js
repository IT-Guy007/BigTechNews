/**
 * Static Site Generator for Big Tech News
 * Generates HTML pages from digest JSON data
 */

const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');
const { CATEGORIES } = require('../scraper/sources');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

/**
 * Read and parse a template file
 */
async function readTemplate(name) {
  const filepath = path.join(TEMPLATES_DIR, `${name}.html`);
  return fs.readFile(filepath, 'utf-8');
}

/**
 * Simple template engine - replaces {{variable}} with values
 */
function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

/**
 * Generate highlight HTML
 */
function generateHighlightHTML(highlight, index) {
  const keywords = highlight.matchedKeywords?.slice(0, 3).join(', ') || '';
  return `
    <div class="highlight-item">
      <div class="highlight-number">${index + 1}</div>
      <div class="highlight-content">
        <h3><a href="${highlight.link}" target="_blank" rel="noopener">${escapeHtml(highlight.title)}</a></h3>
        <p class="highlight-description">${escapeHtml(truncate(highlight.description, 200))}</p>
        <div class="highlight-meta">
          <span class="source">${escapeHtml(highlight.source)}</span>
          <span class="keywords">${escapeHtml(keywords)}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate category section HTML
 */
function generateCategoryHTML(categoryKey, articles) {
  const category = CATEGORIES[categoryKey];
  const categoryName = category?.name || categoryKey.replace('_', ' ');
  
  const articlesList = articles.slice(0, 8).map(article => `
    <li class="category-article">
      <a href="${article.link}" target="_blank" rel="noopener">${escapeHtml(article.source)}</a>
      ${escapeHtml(truncate(article.title, 80))}
    </li>
  `).join('');

  return `
    <div class="category-section" id="category-${categoryKey}">
      <h4>${escapeHtml(categoryName)}</h4>
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
  
  // Generate highlights HTML
  const highlightsHTML = digest.highlights
    .map((h, i) => generateHighlightHTML(h, i))
    .join('');

  // Generate categories HTML
  const categoriesHTML = Object.entries(digest.byCategory)
    .filter(([_, articles]) => articles.length > 0)
    .sort((a, b) => b[1].length - a[1].length) // Sort by article count
    .map(([key, articles]) => generateCategoryHTML(key, articles))
    .join('');

  const html = render(template, {
    title: digest.title,
    dateRange: digest.dateRange,
    totalArticles: digest.totalArticles,
    highlightsHTML: highlightsHTML,
    categoriesHTML: categoriesHTML,
    generatedAt: new Date(digest.generatedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    prevLink: '', // Will be set later
    nextLink: ''  // Will be set later
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
      <div class="digest-articles">${digest.totalArticles} articles</div>
    </a>
  `).join('');

  const latestDigest = index.digests[0];
  const latestSummary = latestDigest ? `
    <div class="latest-digest">
      <h2>Latest: ${escapeHtml(latestDigest.title)}</h2>
      <p>${escapeHtml(latestDigest.dateRange)}</p>
      <a href="${latestDigest.id}.html" class="btn-primary">Read Latest Digest →</a>
    </div>
  ` : '<p>No digests available yet.</p>';

  const html = render(template, {
    lastUpdated: new Date(index.lastUpdated).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    digestsListHTML: digestsListHTML,
    latestSummary: latestSummary,
    totalDigests: index.digests.length
  });

  return html;
}

/**
 * Helper: Escape HTML
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
 * Helper: Truncate text
 */
function truncate(text, maxLength) {
  if (!text) return '';
  const cleaned = text.replace(/<[^>]*>/g, '').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength).trim() + '...';
}

/**
 * Main build function
 */
async function build() {
  console.log('🔨 Building static site...');

  // Ensure public directory exists
  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  // Copy static assets
  try {
    await fs.mkdir(path.join(PUBLIC_DIR, 'css'), { recursive: true });
    const cssSource = path.join(TEMPLATES_DIR, 'styles.css');
    const cssDest = path.join(PUBLIC_DIR, 'css', 'styles.css');
    await fs.copyFile(cssSource, cssDest);
    console.log('Copied styles.css');
  } catch (error) {
    console.error('Error copying CSS:', error.message);
  }

  // Read index
  let index;
  try {
    const indexContent = await fs.readFile(path.join(DATA_DIR, 'index.json'), 'utf-8');
    index = JSON.parse(indexContent);
  } catch (error) {
    console.log('No index.json found, creating empty index');
    index = { lastUpdated: new Date().toISOString(), digests: [] };
  }

  // Generate index page
  const indexHTML = await generateIndexPage(index);
  await fs.writeFile(path.join(PUBLIC_DIR, 'index.html'), indexHTML);
  console.log('Generated index.html');

  // Generate individual digest pages
  for (let i = 0; i < index.digests.length; i++) {
    const digestInfo = index.digests[i];
    
    try {
      const digestPath = path.join(DATA_DIR, 'digests', `${digestInfo.id}.json`);
      const digestContent = await fs.readFile(digestPath, 'utf-8');
      const digest = JSON.parse(digestContent);

      // Add navigation links
      digest.prevLink = i < index.digests.length - 1 ? `${index.digests[i + 1].id}.html` : '';
      digest.nextLink = i > 0 ? `${index.digests[i - 1].id}.html` : '';

      const pageHTML = await generateDigestPage(digest);
      await fs.writeFile(path.join(PUBLIC_DIR, `${digestInfo.id}.html`), pageHTML);
      console.log(`Generated ${digestInfo.id}.html`);
    } catch (error) {
      console.error(`Error generating ${digestInfo.id}: ${error.message}`);
    }
  }

  console.log('\n✅ Build completed successfully!');
}

// Run build
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
