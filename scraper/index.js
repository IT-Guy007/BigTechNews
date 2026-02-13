#!/usr/bin/env node
/**
 * Big Tech News Scraper
 * Aggregates news from major tech sources with daily, weekly, and monthly digests
 */

const Parser = require('rss-parser');
const fs = require('fs').promises;
const path = require('path');
const { format, subDays, subWeeks, subMonths, isWithinInterval, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getISOWeek, getISOWeekYear } = require('date-fns');
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
const DEFAULT_WEEKS_TO_BACKFILL = 4;
const MIN_RELEVANCE_SCORE = 3;

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'BigTechNews/1.0 (News Aggregator)'
  }
});

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    mode: 'daily', // daily, weekly, monthly, backfill
    weeks: DEFAULT_WEEKS_TO_BACKFILL
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--daily' || arg === '-d') config.mode = 'daily';
    else if (arg === '--weekly' || arg === '-w') config.mode = 'weekly';
    else if (arg === '--monthly' || arg === '-m') config.mode = 'monthly';
    else if (arg === '--backfill' || arg === '-b') config.mode = 'backfill';
    else if ((arg === '--weeks' || arg === '-n') && args[i + 1]) {
      config.weeks = parseInt(args[i + 1], 10) || DEFAULT_WEEKS_TO_BACKFILL;
      i++;
    }
  }

  return config;
}

/**
 * Extract image from RSS entry
 */
function extractImage(entry) {
  // Check enclosure (common in RSS feeds)
  if (entry.enclosure?.url && entry.enclosure.type?.startsWith('image/')) {
    return entry.enclosure.url;
  }
  
  // Check media:content
  if (entry['media:content']?.$.url) {
    return entry['media:content'].$.url;
  }
  
  // Check media:thumbnail
  if (entry['media:thumbnail']?.$.url) {
    return entry['media:thumbnail'].$.url;
  }
  
  // Try to find image in content/description
  const content = entry.content || entry['content:encoded'] || entry.description || '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    return imgMatch[1];
  }
  
  return null;
}

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
      priority: source.priority || 2,
      image: extractImage(entry)
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
    if (pattern.test(text)) return true;
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
  
  if (shouldExclude(article.title)) {
    return { score: 0, reasons: ['excluded'] };
  }
  
  let score = 0;
  const reasons = [];
  
  for (const company of BIG_TECH_COMPANIES) {
    if (text.includes(company.toLowerCase())) {
      score += 2;
      reasons.push(company);
    }
  }
  
  for (const keyword of HIGH_IMPACT_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      score += 3;
      if (!reasons.includes(keyword)) reasons.push(keyword);
    }
  }
  
  for (const topic of RELEVANT_TOPICS) {
    if (text.includes(topic.toLowerCase())) {
      score += 1;
      if (!reasons.includes(topic)) reasons.push(topic);
    }
  }
  
  if (article.priority === 1) score += 1;
  
  for (const company of BIG_TECH_COMPANIES) {
    if (title.includes(company.toLowerCase())) score += 2;
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
      if (text.includes(keyword.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = categoryKey;
    }
  }
  return bestCategory;
}

/**
 * Check if article is within date range
 */
function isInRange(articleDate, start, end) {
  try {
    const date = typeof articleDate === 'string' ? parseISO(articleDate) : articleDate;
    return isWithinInterval(date, { start, end });
  } catch {
    return false;
  }
}

/**
 * Get week number and year (ISO week) using date-fns
 */
function getWeekInfo(date) {
  const d = new Date(date);
  return { week: getISOWeek(d), year: getISOWeekYear(d) };
}

/**
 * Generate ID in format YY-W (e.g., 26-5 for week 5 of 2026)
 */
function generateWeekId(week, year) {
  return `${String(year).slice(-2)}-${week}`;
}

/**
 * Generate ID for daily digest (e.g., 26-02-05)
 */
function generateDayId(date) {
  return format(date, 'yy-MM-dd');
}

/**
 * Generate ID for monthly digest (e.g., 26-02)
 */
function generateMonthId(date) {
  return format(date, 'yy-MM');
}

/**
 * Deduplicate articles by similarity
 */
function deduplicateArticles(articles) {
  const seen = new Set();
  const unique = [];
  
  for (const article of articles) {
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
 * Fetch all feeds
 */
async function fetchAllFeeds() {
  console.log('Fetching feeds from all sources...');
  const allArticles = [];

  for (const [key, source] of Object.entries(SOURCES)) {
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
 * Process articles for a date range
 */
function processArticles(articles, start, end) {
  const rangeArticles = articles.filter(a => isInRange(a.published, start, end));
  
  const relevantArticles = rangeArticles
    .map(article => {
      const { score, reasons } = calculateRelevance(article);
      const category = categorizeArticle(article);
      return { ...article, relevanceScore: score, matchedKeywords: reasons, category };
    })
    .filter(article => article.relevanceScore >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  const uniqueArticles = deduplicateArticles(relevantArticles);

  const byCategory = {};
  for (const article of uniqueArticles) {
    if (article.category) {
      if (!byCategory[article.category]) byCategory[article.category] = [];
      byCategory[article.category].push(article);
    }
  }

  return {
    highlights: uniqueArticles.slice(0, 10),
    byCategory,
    totalArticles: uniqueArticles.length
  };
}

/**
 * Generate daily digest
 */
async function generateDailyDigest(date, articles) {
  const start = startOfDay(date);
  const end = endOfDay(date);
  const processed = processArticles(articles, start, end);
  
  const id = generateDayId(date);
  
  return {
    type: 'daily',
    id,
    title: format(date, 'EEEE, MMM d'),
    dateRange: format(date, 'MMMM d, yyyy'),
    date: format(date, 'yyyy-MM-dd'),
    generatedAt: new Date().toISOString(),
    ...processed
  };
}

/**
 * Generate weekly digest using ISO week dates
 */
async function generateWeeklyDigest(weekNum, year, articles) {
  // Calculate ISO week 1 start: the Monday of the week containing Jan 4
  const jan4 = new Date(year, 0, 4);
  const week1Start = startOfWeek(jan4, { weekStartsOn: 1 });
  
  // Calculate this week's start/end by adding weeks
  const weekStart = new Date(week1Start);
  weekStart.setDate(week1Start.getDate() + (weekNum - 1) * 7);
  
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const processed = processArticles(articles, weekStart, weekEnd);
  const id = generateWeekId(weekNum, year);

  return {
    type: 'weekly',
    id,
    week: weekNum,
    year,
    title: `Week ${weekNum}`,
    dateRange: `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`,
    generatedAt: new Date().toISOString(),
    ...processed
  };
}

/**
 * Generate monthly digest
 */
async function generateMonthlyDigest(date, articles) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const processed = processArticles(articles, start, end);
  
  const id = generateMonthId(date);
  
  return {
    type: 'monthly',
    id,
    title: format(date, 'MMMM yyyy'),
    dateRange: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    generatedAt: new Date().toISOString(),
    ...processed
  };
}

/**
 * Save digest to JSON file
 */
async function saveDigest(digest, subdir = 'digests') {
  const dir = path.join(DATA_DIR, subdir);
  await fs.mkdir(dir, { recursive: true });
  
  const filename = `${digest.id}.json`;
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, JSON.stringify(digest, null, 2));
  
  console.log(`  💾 Saved: ${subdir}/${filename} (${digest.totalArticles} articles)`);
  return filepath;
}

/**
 * Update index of all digests
 */
async function updateIndex() {
  const index = {
    lastUpdated: new Date().toISOString(),
    daily: [],
    weekly: [],
    monthly: []
  };

  // Load daily digests
  try {
    const dailyDir = path.join(DATA_DIR, 'daily');
    const files = await fs.readdir(dailyDir);
    for (const file of files.filter(f => f.endsWith('.json'))) {
      const content = await fs.readFile(path.join(dailyDir, file), 'utf-8');
      const digest = JSON.parse(content);
      if (digest.totalArticles > 0) {
        index.daily.push({
          id: digest.id,
          title: digest.title,
          date: digest.date,
          dateRange: digest.dateRange,
          totalArticles: digest.totalArticles,
          highlightCount: digest.highlights?.length || 0
        });
      }
    }
    index.daily.sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {}

  // Load weekly digests
  try {
    const weeklyDir = path.join(DATA_DIR, 'weekly');
    const files = await fs.readdir(weeklyDir);
    for (const file of files.filter(f => f.endsWith('.json'))) {
      const content = await fs.readFile(path.join(weeklyDir, file), 'utf-8');
      const digest = JSON.parse(content);
      if (digest.totalArticles > 0) {
        index.weekly.push({
          id: digest.id,
          title: digest.title,
          week: digest.week,
          year: digest.year,
          dateRange: digest.dateRange,
          totalArticles: digest.totalArticles,
          highlightCount: digest.highlights?.length || 0
        });
      }
    }
    index.weekly.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.week - a.week;
    });
  } catch (e) {}

  // Load monthly digests
  try {
    const monthlyDir = path.join(DATA_DIR, 'monthly');
    const files = await fs.readdir(monthlyDir);
    for (const file of files.filter(f => f.endsWith('.json'))) {
      const content = await fs.readFile(path.join(monthlyDir, file), 'utf-8');
      const digest = JSON.parse(content);
      if (digest.totalArticles > 0) {
        index.monthly.push({
          id: digest.id,
          title: digest.title,
          month: digest.month,
          year: digest.year,
          dateRange: digest.dateRange,
          totalArticles: digest.totalArticles,
          highlightCount: digest.highlights?.length || 0
        });
      }
    }
    index.monthly.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  } catch (e) {}

  const indexPath = path.join(DATA_DIR, 'index.json');
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
  
  console.log(`\n📋 Index updated: ${index.daily.length} daily, ${index.weekly.length} weekly, ${index.monthly.length} monthly`);
}

/**
 * Main function
 */
async function main() {
  const config = parseArgs();
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║     Big Tech News Digest Scraper       ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\nMode: ${config.mode.toUpperCase()}${config.mode === 'backfill' ? ` (${config.weeks} weeks)` : ''}\n`);

  // Ensure data directories exist
  await fs.mkdir(path.join(DATA_DIR, 'daily'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'weekly'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'monthly'), { recursive: true });

  // Fetch all feeds
  const articles = await fetchAllFeeds();

  if (articles.length === 0) {
    console.error('\n❌ No articles fetched. Check your internet connection.');
    process.exit(1);
  }

  const now = new Date();

  switch (config.mode) {
    case 'daily': {
      console.log('\n━━━ Daily Digest ━━━');
      const digest = await generateDailyDigest(now, articles);
      await saveDigest(digest, 'daily');
      break;
    }
    
    case 'weekly': {
      // Generate digest for the PREVIOUS week (the completed one)
      const lastWeekDate = subWeeks(now, 1);
      const weekInfo = getWeekInfo(lastWeekDate);
      console.log(`\n━━━ Week ${weekInfo.week}, ${weekInfo.year} ━━━`);
      const digest = await generateWeeklyDigest(weekInfo.week, weekInfo.year, articles);
      await saveDigest(digest, 'weekly');
      break;
    }
    
    case 'monthly': {
      // Generate digest for the PREVIOUS month (the completed one)
      const lastMonth = subMonths(now, 1);
      console.log(`\n━━━ ${format(lastMonth, 'MMMM yyyy')} ━━━`);
      const digest = await generateMonthlyDigest(lastMonth, articles);
      await saveDigest(digest, 'monthly');
      break;
    }
    
    case 'backfill': {
      console.log(`\n📚 Backfilling ${config.weeks} weeks...\n`);
      
      // Backfill daily (last 7 days)
      console.log('── Daily Digests ──');
      for (let i = 0; i < 7; i++) {
        const date = subDays(now, i);
        const digest = await generateDailyDigest(date, articles);
        await saveDigest(digest, 'daily');
      }
      
      // Backfill weekly
      console.log('\n── Weekly Digests ──');
      for (let i = 0; i < config.weeks; i++) {
        const date = subWeeks(now, i);
        const weekInfo = getWeekInfo(date);
        const digest = await generateWeeklyDigest(weekInfo.week, weekInfo.year, articles);
        await saveDigest(digest, 'weekly');
      }
      
      // Backfill monthly (current + previous month)
      console.log('\n── Monthly Digests ──');
      for (let i = 0; i < 2; i++) {
        const date = subMonths(now, i);
        const digest = await generateMonthlyDigest(date, articles);
        await saveDigest(digest, 'monthly');
      }
      break;
    }
  }

  // Update the index
  await updateIndex();

  console.log('\n✅ Completed!\n');
  
  // Explicit exit to prevent hanging
  process.exit(0);
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
