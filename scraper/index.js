/**
 * Big Tech News Scraper
 * Aggregates news from major tech sources, filters for digest-worthy content,
 * and generates weekly digests
 */

const Parser = require('rss-parser');
const fs = require('fs').promises;
const path = require('path');
const { format, subWeeks, isWithinInterval, parseISO } = require('date-fns');
const { 
  SOURCES, 
  HIGH_IMPACT_KEYWORDS, 
  BIG_TECH_COMPANIES, 
  RELEVANT_TOPICS, 
  EXCLUDED_PATTERNS, 
  CATEGORIES 
} = require('./sources');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const WEEKS_TO_BACKFILL = 4;
const MIN_RELEVANCE_SCORE = 3; // Higher threshold for quality

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'BigTechNews/1.0 (Personal News Aggregator)'
  }
});

/**
 * Fetch RSS feed from a source
 */
async function fetchFeed(sourceKey, source) {
  try {
    const feed = await parser.parseURL(source.rss);
    
    return feed.items.map(entry => ({
      title: entry.title || '',
      link: entry.link || '',
      description: entry.contentSnippet || entry.content || entry.description || '',
      published: entry.isoDate || entry.pubDate || new Date().toISOString(),
      source: source.name,
      sourceKey: sourceKey,
      priority: source.priority || 2
    }));
  } catch (error) {
    console.error(`  ⚠ ${source.name}: ${error.message}`);
    return [];
  }
}

/**
 * Check if article should be excluded
 */
function shouldExclude(text) {
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate relevance score for an article
 */
function calculateRelevance(article) {
  const title = article.title.toLowerCase();
  const description = (article.description || '').toLowerCase().substring(0, 500);
  const text = `${title} ${description}`;
  
  // First check exclusions
  if (shouldExclude(article.title)) {
    return { score: 0, reasons: ['excluded'] };
  }
  
  let score = 0;
  const reasons = [];
  
  // Big tech company mentions (high value)
  for (const company of BIG_TECH_COMPANIES) {
    if (text.includes(company.toLowerCase())) {
      score += 2;
      reasons.push(company);
    }
  }
  
  // High-impact keywords (very high value)
  for (const keyword of HIGH_IMPACT_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      score += 3;
      if (!reasons.includes(keyword)) reasons.push(keyword);
    }
  }
  
  // Relevant topics
  for (const topic of RELEVANT_TOPICS) {
    if (text.includes(topic.toLowerCase())) {
      score += 1;
      if (!reasons.includes(topic)) reasons.push(topic);
    }
  }
  
  // Bonus for high-priority sources
  if (article.priority === 1) {
    score += 1;
  }
  
  // Title keywords get extra weight
  for (const company of BIG_TECH_COMPANIES) {
    if (title.includes(company.toLowerCase())) {
      score += 2; // Additional bonus for title mention
    }
  }
  
  return { score, reasons: reasons.slice(0, 5) };
}

/**
 * Categorize an article
 */
function categorizeArticle(article) {
  const text = `${article.title} ${article.description || ''}`.toLowerCase();
  let bestCategory = null;
  let bestScore = 0;

  for (const [categoryKey, category] of Object.entries(CATEGORIES)) {
    let score = 0;
    for (const keyword of category.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = categoryKey;
    }
  }

  return bestCategory;
}

/**
 * Check if article is within a specific week
 */
function isInWeek(articleDate, weekStart, weekEnd) {
  try {
    const date = typeof articleDate === 'string' ? parseISO(articleDate) : articleDate;
    return isWithinInterval(date, { start: weekStart, end: weekEnd });
  } catch {
    return false;
  }
}

/**
 * Get week number and year
 */
function getWeekInfo(date) {
  const d = new Date(date);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  
  return {
    week: weekNo,
    year: d.getUTCFullYear()
  };
}

/**
 * Deduplicate articles by similarity
 */
function deduplicateArticles(articles) {
  const seen = new Set();
  const unique = [];
  
  for (const article of articles) {
    // Create a simple signature from title words
    const words = article.title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .sort()
      .slice(0, 5)
      .join('|');
    
    if (!seen.has(words)) {
      seen.add(words);
      unique.push(article);
    }
  }
  
  return unique;
}

/**
 * Fetch all feeds and aggregate articles
 */
async function fetchAllFeeds() {
  console.log('Fetching feeds from all sources...');
  const allArticles = [];

  const sourceEntries = Object.entries(SOURCES);
  
  for (const [key, source] of sourceEntries) {
    process.stdout.write(`  📥 ${source.name}... `);
    const articles = await fetchFeed(key, source);
    if (articles.length > 0) {
      console.log(`${articles.length} articles`);
      allArticles.push(...articles);
    }
  }

  console.log(`\n📊 Total fetched: ${allArticles.length} articles`);
  return allArticles;
}

/**
 * Process articles for a specific week
 */
function processWeek(articles, weekStart, weekEnd) {
  // Filter articles for this week
  const weekArticles = articles.filter(article => 
    isInWeek(article.published, weekStart, weekEnd)
  );

  console.log(`  📅 Articles in date range: ${weekArticles.length}`);

  // Calculate relevance and filter
  const relevantArticles = weekArticles
    .map(article => {
      const { score, reasons } = calculateRelevance(article);
      const category = categorizeArticle(article);
      return { ...article, relevanceScore: score, matchedKeywords: reasons, category };
    })
    .filter(article => article.relevanceScore >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  console.log(`  ✅ Digest-worthy articles: ${relevantArticles.length}`);

  // Deduplicate
  const uniqueArticles = deduplicateArticles(relevantArticles);
  console.log(`  🔄 After deduplication: ${uniqueArticles.length}`);

  // Group by category
  const byCategory = {};
  for (const article of uniqueArticles) {
    if (article.category) {
      if (!byCategory[article.category]) {
        byCategory[article.category] = [];
      }
      byCategory[article.category].push(article);
    }
  }

  // Get highlights (top 10 most relevant)
  const highlights = uniqueArticles.slice(0, 10);

  return {
    highlights,
    byCategory,
    totalArticles: uniqueArticles.length,
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    weekEnd: format(weekEnd, 'yyyy-MM-dd')
  };
}

/**
 * Generate digest data for a week
 */
async function generateDigest(weekNumber, year, articles) {
  // Calculate week boundaries (Monday to Sunday)
  const jan1 = new Date(year, 0, 1);
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() + ((8 - jan1.getDay()) % 7));
  
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const processed = processWeek(articles, weekStart, weekEnd);

  const digest = {
    week: weekNumber,
    year: year,
    id: `week-${weekNumber}-${year}`,
    title: `Week ${weekNumber}, ${year}`,
    dateRange: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
    generatedAt: new Date().toISOString(),
    ...processed
  };

  return digest;
}

/**
 * Save digest to JSON file
 */
async function saveDigest(digest) {
  const filename = `${digest.id}.json`;
  const filepath = path.join(DATA_DIR, 'digests', filename);
  
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, JSON.stringify(digest, null, 2));
  
  console.log(`  💾 Saved: ${filename}`);
  return filepath;
}

/**
 * Update index of all digests
 */
async function updateIndex() {
  const digestsDir = path.join(DATA_DIR, 'digests');
  
  try {
    const files = await fs.readdir(digestsDir);
    const digests = [];

    for (const file of files) {
      if (file.endsWith('.json') && file.startsWith('week-')) {
        const content = await fs.readFile(path.join(digestsDir, file), 'utf-8');
        const digest = JSON.parse(content);
        // Only include digests that have articles
        if (digest.totalArticles > 0) {
          digests.push({
            id: digest.id,
            title: digest.title,
            week: digest.week,
            year: digest.year,
            dateRange: digest.dateRange,
            totalArticles: digest.totalArticles,
            highlightCount: digest.highlights?.length || 0,
            generatedAt: digest.generatedAt
          });
        }
      }
    }

    // Sort by year and week (newest first)
    digests.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.week - a.week;
    });

    const indexPath = path.join(DATA_DIR, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify({ 
      lastUpdated: new Date().toISOString(),
      digests 
    }, null, 2));

    console.log(`\n📋 Index updated: ${digests.length} digests`);
  } catch (error) {
    console.error('Error updating index:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const isBackfill = args.includes('--backfill');
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║     Big Tech News Digest Scraper       ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\nMode: ${isBackfill ? '🔄 Backfill' : '📆 Current Week'}\n`);

  // Ensure data directories exist
  await fs.mkdir(path.join(DATA_DIR, 'digests'), { recursive: true });

  // Fetch all feeds
  const articles = await fetchAllFeeds();

  if (articles.length === 0) {
    console.error('\n❌ No articles fetched. Check your internet connection.');
    process.exit(1);
  }

  const now = new Date();
  const currentWeek = getWeekInfo(now);

  if (isBackfill) {
    console.log(`\n📚 Backfilling ${WEEKS_TO_BACKFILL} weeks...\n`);
    
    for (let i = 0; i < WEEKS_TO_BACKFILL; i++) {
      const date = subWeeks(now, i);
      const weekInfo = getWeekInfo(date);
      
      console.log(`\n━━━ Week ${weekInfo.week}, ${weekInfo.year} ━━━`);
      const digest = await generateDigest(weekInfo.week, weekInfo.year, articles);
      await saveDigest(digest);
    }
  } else {
    console.log(`\n━━━ Processing Week ${currentWeek.week}, ${currentWeek.year} ━━━`);
    const digest = await generateDigest(currentWeek.week, currentWeek.year, articles);
    await saveDigest(digest);
  }

  // Update the index
  await updateIndex();

  console.log('\n✅ Scraper completed successfully!\n');
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
