/**
 * Big Tech News Scraper
 * Aggregates news from major tech sources, filters for big tech relevance,
 * and generates weekly digests
 */

const Parser = require('rss-parser');
const fs = require('fs').promises;
const path = require('path');
const { format, subWeeks, startOfWeek, endOfWeek, isWithinInterval, parseISO } = require('date-fns');
const { SOURCES, BIG_TECH_KEYWORDS, CATEGORIES } = require('./sources');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const WEEKS_TO_BACKFILL = 4;

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'BigTechNews/1.0 (Personal News Aggregator)'
  }
});

/**
 * Fetch RSS feed from a source
 */
async function fetchFeed(source) {
  try {
    const feed = await parser.parseURL(source.rss);
    
    return feed.items.map(entry => ({
      title: entry.title || '',
      link: entry.link || '',
      description: entry.contentSnippet || entry.content || entry.description || '',
      published: entry.isoDate || entry.pubDate || new Date().toISOString(),
      source: source.name,
      sourceKey: Object.keys(SOURCES).find(key => SOURCES[key].name === source.name)
    }));
  } catch (error) {
    console.error(`Error fetching ${source.name}: ${error.message}`);
    return [];
  }
}

/**
 * Calculate relevance score for an article
 */
function calculateRelevance(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  let score = 0;
  let matchedKeywords = [];

  for (const keyword of BIG_TECH_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      score += keyword.split(' ').length; // Multi-word keywords get higher scores
      matchedKeywords.push(keyword);
    }
  }

  return { score, matchedKeywords };
}

/**
 * Categorize an article
 */
function categorizeArticle(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  let bestCategory = 'etc';
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
  // Get ISO week number
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
 * Fetch all feeds and aggregate articles
 */
async function fetchAllFeeds() {
  console.log('Fetching feeds from all sources...');
  const allArticles = [];

  const feedPromises = Object.values(SOURCES).map(source => fetchFeed(source));
  const results = await Promise.allSettled(feedPromises);

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      allArticles.push(...result.value);
    }
  }

  console.log(`Fetched ${allArticles.length} total articles`);
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

  // Calculate relevance and filter
  const relevantArticles = weekArticles
    .map(article => {
      const { score, matchedKeywords } = calculateRelevance(article);
      const category = categorizeArticle(article);
      return { ...article, relevanceScore: score, matchedKeywords, category };
    })
    .filter(article => article.relevanceScore >= 2) // At least 2 keyword matches
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Group by category
  const byCategory = {};
  for (const article of relevantArticles) {
    if (!byCategory[article.category]) {
      byCategory[article.category] = [];
    }
    byCategory[article.category].push(article);
  }

  // Get highlights (top 10 most relevant)
  const highlights = relevantArticles.slice(0, 10);

  return {
    highlights,
    byCategory,
    totalArticles: relevantArticles.length,
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
  
  console.log(`Saved digest: ${filename}`);
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

    console.log(`Updated index with ${digests.length} digests`);
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
  
  console.log('🚀 Starting Big Tech News Scraper');
  console.log(`Mode: ${isBackfill ? 'Backfill' : 'Current Week'}`);

  // Ensure data directories exist
  await fs.mkdir(path.join(DATA_DIR, 'digests'), { recursive: true });

  // Fetch all feeds
  const articles = await fetchAllFeeds();

  if (articles.length === 0) {
    console.error('No articles fetched. Check your internet connection and feed URLs.');
    process.exit(1);
  }

  const now = new Date();
  const currentWeek = getWeekInfo(now);

  if (isBackfill) {
    // Generate digests for the past several weeks
    console.log(`Backfilling ${WEEKS_TO_BACKFILL} weeks...`);
    
    for (let i = 0; i < WEEKS_TO_BACKFILL; i++) {
      const date = subWeeks(now, i);
      const weekInfo = getWeekInfo(date);
      
      console.log(`\nProcessing Week ${weekInfo.week}, ${weekInfo.year}...`);
      const digest = await generateDigest(weekInfo.week, weekInfo.year, articles);
      await saveDigest(digest);
    }
  } else {
    // Generate digest for current week only
    console.log(`\nProcessing current week (Week ${currentWeek.week}, ${currentWeek.year})...`);
    const digest = await generateDigest(currentWeek.week, currentWeek.year, articles);
    await saveDigest(digest);
  }

  // Update the index
  await updateIndex();

  console.log('\n✅ Scraper completed successfully!');
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
