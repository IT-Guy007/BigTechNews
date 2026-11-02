#!/usr/bin/env node
/**
 * Big Tech News Scraper
 *
 * Modes:
 *   --daily     (default) Fetch all feeds and MERGE new articles into today's and
 *               yesterday's daily files, then refresh last week's and last month's
 *               digests from the daily files. Safe to run many times a day.
 *   --weekly    Rebuild the last completed week's digest from daily files (no fetch)
 *   --monthly   Rebuild the last completed month's digest from daily files (no fetch)
 *   --rebuild   Rebuild ALL weekly and monthly digests from daily files (no fetch)
 *   --rescore   Re-score and re-categorize every stored daily file, then --rebuild
 *               (no fetch, no articles dropped)
 *   --backfill  Same as --daily followed by --rebuild (feeds can't go further back)
 *
 * All day boundaries are UTC.
 */

process.env.TZ = 'UTC';

const Parser = require('rss-parser');
const fs = require('fs').promises;
const path = require('path');
const {
  format, subDays, subWeeks, subMonths, startOfMonth, endOfMonth,
  startOfISOWeek, endOfISOWeek, getISOWeek, getISOWeekYear, setISOWeek, setISOWeekYear
} = require('date-fns');
const {
  SOURCES, HIGH_IMPACT_KEYWORDS, BIG_TECH_COMPANIES, RELEVANT_TOPICS,
  EXCLUDED_PATTERNS, PENALIZED_PATTERNS, CATEGORIES
} = require('./sources');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MIN_RELEVANCE_SCORE = 3;
const HIGHLIGHT_COUNT = 10;
const MAX_DESCRIPTION = 500;
const FETCH_TIMEOUT_MS = 20000;
const USER_AGENT = 'Mozilla/5.0 (compatible; BigTechNews/2.0; +https://github.com/IT-Guy007/BigTechNews)';

const parser = new Parser({
  customFields: { item: [['media:content', 'media:content'], ['media:thumbnail', 'media:thumbnail']] }
});

// ---------------------------------------------------------------------------
// Text matching: whole words only, plural/possessive allowed
// ---------------------------------------------------------------------------

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordRegex(keyword) {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(keyword.toLowerCase())}(?:s|es|'s)?(?![\\p{L}\\p{N}])`, 'u');
}

function compile(list) {
  return list.map(k => ({ k, re: wordRegex(k) }));
}

const M_COMPANIES = compile(BIG_TECH_COMPANIES);
const M_HIGH = compile(HIGH_IMPACT_KEYWORDS);
const M_TOPICS = compile(RELEVANT_TOPICS);
const M_CATEGORIES = Object.entries(CATEGORIES).map(([key, c]) => ({ key, words: compile(c.keywords) }));

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ');
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“').replace(/&#8221;|&rdquo;/g, '”').replace(/&#8211;|&ndash;/g, '–').replace(/&#8212;|&mdash;/g, '—')
    .replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Scoring & categorization
// ---------------------------------------------------------------------------

function isExcluded(title) {
  return EXCLUDED_PATTERNS.some(p => p.test(title));
}

function calculateRelevance(article) {
  const title = normalize(article.title);
  const description = normalize(article.description).slice(0, MAX_DESCRIPTION);
  const text = `${title} ${description}`;

  if (isExcluded(article.title)) return { score: 0, reasons: ['excluded'] };

  let score = 0;
  const titleHits = [];
  const otherHits = [];
  const note = (k, inTitle) => {
    const list = inTitle ? titleHits : otherHits;
    if (!titleHits.includes(k) && !list.includes(k)) list.push(k);
  };

  // Official newsrooms rarely name themselves; credit their company
  const company = SOURCES[article.sourceKey]?.company;
  if (company) { score += 4; note(company, true); }

  for (const { k, re } of M_COMPANIES) {
    if (k === company) continue;
    if (re.test(title)) { score += 4; note(k, true); }
    else if (re.test(description)) { score += 2; note(k, false); }
  }
  for (const { k, re } of M_HIGH) {
    if (re.test(text)) { score += 3; note(k, re.test(title)); }
  }
  for (const { k, re } of M_TOPICS) {
    if (re.test(text)) { score += 1; note(k, re.test(title)); }
  }

  // Broad feeds (markets, front pages) only count when a tracked company or big story is named
  if (SOURCES[article.sourceKey]?.general) {
    const strong = [...titleHits, ...otherHits].some(k => M_COMPANIES.some(c => c.k === k) || M_HIGH.some(h => h.k === k));
    if (!strong) return { score: 0, reasons: ['general-feed: no tracked company'] };
  }

  if (article.priority === 1) score += 1;
  if (PENALIZED_PATTERNS.some(p => p.test(article.title))) score -= 4;

  return { score: Math.max(score, 0), reasons: [...titleHits, ...otherHits].slice(0, 6) };
}

function categorizeArticle(article) {
  const title = normalize(article.title);
  const company = SOURCES[article.sourceKey]?.company || '';
  const description = normalize(`${company} ${article.description || ''}`).slice(0, MAX_DESCRIPTION);
  let best = 'other';
  let bestScore = 0;
  for (const { key, words } of M_CATEGORIES) {
    let s = 0;
    for (const { re } of words) {
      if (re.test(title)) s += 2;
      else if (re.test(description)) s += 1;
    }
    if (s > bestScore) { bestScore = s; best = key; }
  }
  return best;
}

function enrich(raw) {
  let article = { ...raw, title: stripHtml(raw.title), description: stripHtml(raw.description).slice(0, MAX_DESCRIPTION) };
  if (SOURCES[article.sourceKey]?.group === 'aggregator') article = cleanAttribution(article);
  const { score, reasons } = calculateRelevance(article);
  return { ...article, baseScore: score, relevanceScore: score, matchedKeywords: reasons, category: categorizeArticle(article) };
}

// ---------------------------------------------------------------------------
// Dedup: same link, or the same story covered by several outlets
// ---------------------------------------------------------------------------

function normalizeLink(link) {
  try {
    const u = new URL(link);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|src$|cmpid$|mod$|guccounter$|taid$|guce_)/i.test(k)) u.searchParams.delete(k);
    }
    u.hostname = u.hostname.replace(/^www\./, '');
    return (u.origin.replace('://www.', '://') + u.pathname.replace(/\/+$/, '') + (u.search || '')).toLowerCase();
  } catch {
    return String(link || '').trim().toLowerCase();
  }
}

const STOPWORDS = new Set(('the a an and or but of to in on for with at by from as is are was were be been its it this that these those ' +
  'new says said will would could can may might has have had after over into about than more most just now how why what who ' +
  'report reportedly update first us out up its their his her they you your our not no').split(' '));

function titleTokens(title) {
  return new Set(normalize(title).replace(/'s\b/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(' ')
    .filter(w => w.length > 2 && !STOPWORDS.has(w)));
}

function sameStory(a, b) {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  if (shared < 3) return false;
  return shared / Math.min(a.size, b.size) >= 0.6;
}

/**
 * Collapse duplicates. The best-scoring article of each story is kept; the others
 * are listed in `alsoIn`. Stories covered by several outlets get a boost (max +3).
 */
function clusterArticles(articles) {
  // 1. exact link duplicates
  const byLink = new Map();
  for (const a of articles) {
    const key = normalizeLink(a.link);
    const prev = byLink.get(key);
    if (!prev || (a.baseScore ?? a.relevanceScore ?? 0) > (prev.baseScore ?? prev.relevanceScore ?? 0)) byLink.set(key, a);
  }

  // 2. same story across outlets (best article first)
  const base = (x) => x.baseScore ?? x.relevanceScore ?? 0;
  const sorted = [...byLink.values()].sort((a, b) =>
    (base(b) - base(a)) || (a.priority - b.priority) || String(a.published).localeCompare(String(b.published)));
  const clusters = [];
  for (const a of sorted) {
    const tokens = titleTokens(a.title);
    const home = clusters.find(c => c.tokens.some(t => sameStory(t, tokens)));
    if (home) {
      home.members.push(a);
      home.tokens.push(tokens);
    } else {
      clusters.push({ lead: a, members: [], tokens: [tokens] });
    }
  }

  return clusters.map(({ lead, members }) => {
    const also = new Map();
    for (const prev of lead.alsoIn || []) also.set(normalizeLink(prev.link), prev);
    for (const m of members) {
      for (const x of [m, ...(m.alsoIn || [])]) {
        const key = normalizeLink(x.link);
        if (key !== normalizeLink(lead.link) && !also.has(key)) also.set(key, { source: x.source, title: x.title, link: x.link });
      }
    }
    const alsoIn = [...also.values()];
    const outlets = new Set([lead.source, ...alsoIn.map(x => x.source)]).size;
    const out = { ...lead, relevanceScore: (lead.baseScore ?? lead.relevanceScore ?? 0) + Math.min(outlets - 1, 3) };
    if (alsoIn.length) out.alsoIn = alsoIn; else delete out.alsoIn;
    return out;
  });
}

function rank(articles) {
  return articles.sort((a, b) =>
    (b.relevanceScore - a.relevanceScore) ||
    ((b.alsoIn?.length || 0) - (a.alsoIn?.length || 0)) ||
    (a.priority - b.priority) ||
    String(b.published).localeCompare(String(a.published)));
}

function buildDigestBody(articles) {
  const ranked = rank(clusterArticles(articles));
  const byCategory = {};
  for (const a of ranked) (byCategory[a.category || 'other'] ||= []).push(a);
  return { highlights: ranked.slice(0, HIGHLIGHT_COUNT), byCategory, totalArticles: ranked.length };
}

/** Every article stored in a digest file (highlights are also in byCategory) */
function articlesOf(digest) {
  const map = new Map();
  for (const a of [...(digest.highlights || []), ...Object.values(digest.byCategory || {}).flat()]) {
    const key = normalizeLink(a.link);
    if (!map.has(key)) map.set(key, a);
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

function extractImage(entry) {
  if (entry.enclosure?.url && (!entry.enclosure.type || entry.enclosure.type.startsWith('image/'))) return entry.enclosure.url;
  const media = entry['media:content'];
  if (media?.$?.url) return media.$.url;
  if (Array.isArray(media) && media[0]?.$?.url) return media[0].$.url;
  if (entry['media:thumbnail']?.$?.url) return entry['media:thumbnail'].$.url;
  const content = entry['content:encoded'] || entry.content || entry.description || '';
  const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

// Some feeds ship stray "&" characters that break strict XML parsing
function sanitizeXml(xml) {
  return xml.replace(/^﻿/, '').replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      if (res.ok) {
        const text = await res.text();
        // Some feeds intermittently serve an HTML page (consent/CDN error) instead of XML
        if (!/^\s*(?:\uFEFF)?<(?:!doctype html|html)\b/i.test(text)) return text;
        lastError = new Error('got an HTML page instead of a feed');
      } else {
        lastError = new Error(`HTTP ${res.status}`);
        if (res.status !== 429 && res.status < 500) break;
      }
    } catch (e) {
      lastError = e.name === 'TimeoutError' ? new Error('timeout') : e;
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw lastError;
}

/**
 * Aggregators append the original byline: Techmeme titles end in "(Author/Outlet)"
 * and descriptions start with "Author / Outlet: ". Strip both.
 */
function cleanAttribution(article) {
  const m = / \(([^()]{2,80})\/([^()]{2,60})\)$/.exec(article.title);
  if (!m) return article;
  return {
    ...article,
    title: article.title.slice(0, m.index),
    description: article.description.replace(/^[^:]{2,120}\s\/\s[^:]{2,60}:\s*/, ''),
    via: m[2].trim()
  };
}

async function fetchFeed(sourceKey, source) {
  const started = Date.now();
  const fetchedAt = new Date().toISOString();
  try {
    const xml = await fetchText(source.rss);
    const feed = await parser.parseString(sanitizeXml(xml));
    const articles = feed.items
      .map(entry => {
        const date = new Date(entry.isoDate || entry.pubDate || fetchedAt);
        return {
          title: stripHtml(entry.title),
          link: (entry.link || entry.guid || '').trim(),
          description: stripHtml(entry.contentSnippet || entry.summary || entry.content || entry.description || '').slice(0, MAX_DESCRIPTION),
          published: isNaN(date) ? fetchedAt : date.toISOString(),
          source: source.name,
          sourceKey,
          priority: source.priority || 2,
          image: extractImage(entry)
        };
      })
      .filter(a => a.title && /^https?:\/\//.test(a.link));
    return { articles, health: { ok: true, items: articles.length, ms: Date.now() - started } };
  } catch (error) {
    return { articles: [], health: { ok: false, error: String(error.message || error).slice(0, 120), ms: Date.now() - started } };
  }
}

async function fetchAllFeeds() {
  console.log(`Fetching ${Object.keys(SOURCES).length} feeds...`);
  const entries = Object.entries(SOURCES);
  const results = new Array(entries.length);
  let next = 0;
  async function worker() {
    while (next < entries.length) {
      const i = next++;
      results[i] = await fetchFeed(...entries[i]);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));

  const all = [];
  const health = {};
  entries.forEach(([key, source], i) => {
    const { articles, health: h } = results[i];
    health[key] = { name: source.name, group: source.group, ...h };
    console.log(`  ${h.ok ? '✓' : '⚠'} ${source.name.padEnd(22)} ${h.ok ? `${h.items} items` : h.error}`);
    all.push(...articles);
  });
  await saveFeedHealth(health);
  console.log(`\n📊 Fetched ${all.length} items from ${Object.values(health).filter(h => h.ok).length}/${entries.length} feeds`);
  return all;
}

async function saveFeedHealth(health) {
  const file = path.join(DATA_DIR, 'feed-health.json');
  let prev = {};
  try { prev = JSON.parse(await fs.readFile(file, 'utf-8')).feeds || {}; } catch {}
  const now = new Date().toISOString();
  const feeds = {};
  for (const [key, h] of Object.entries(health)) {
    const p = prev[key] || {};
    feeds[key] = {
      ...h,
      lastSuccess: h.ok ? now : p.lastSuccess || null,
      consecutiveFailures: h.ok ? 0 : (p.consecutiveFailures || 0) + 1
    };
  }
  await fs.writeFile(file, JSON.stringify({ checkedAt: now, feeds }, null, 2));
  const dead = Object.values(feeds).filter(f => f.consecutiveFailures >= 12);
  if (dead.length) console.log(`  ⚠ Failing for 12+ runs: ${dead.map(f => f.name).join(', ')}`);
}

// ---------------------------------------------------------------------------
// Digest files
// ---------------------------------------------------------------------------

const dayKey = (d) => d.toISOString().slice(0, 10);
const dayDate = (ymd) => new Date(`${ymd}T12:00:00Z`);
const dayId = (ymd) => ymd.slice(2);

async function readJSON(file) {
  return JSON.parse(await fs.readFile(file, 'utf-8'));
}

async function readDaily(ymd) {
  try { return await readJSON(path.join(DATA_DIR, 'daily', `${dayId(ymd)}.json`)); } catch { return null; }
}

async function saveDigest(digest, subdir) {
  const dir = path.join(DATA_DIR, subdir);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${digest.id}.json`), JSON.stringify(digest, null, 2));
  console.log(`  💾 ${subdir}/${digest.id}.json (${digest.totalArticles} articles)`);
}

function dailyDigest(ymd, articles) {
  const d = dayDate(ymd);
  return {
    type: 'daily',
    id: dayId(ymd),
    title: format(d, 'EEEE, MMM d'),
    dateRange: format(d, 'MMMM d, yyyy'),
    date: ymd,
    generatedAt: new Date().toISOString(),
    ...buildDigestBody(articles)
  };
}

/**
 * Links already stored in the last `days` daily files, mapped to their day.
 * Feeds without publish dates (e.g. Nikkei Asia) get the fetch time as date, so
 * without this an item could be re-added on every new day it stays in the feed.
 */
async function recentLinks(now, days = 8) {
  const map = new Map();
  for (let i = 0; i < days; i++) {
    const ymd = dayKey(subDays(now, i));
    const d = await readDaily(ymd);
    if (!d) continue;
    for (const a of articlesOf(d)) {
      for (const x of [a, ...(a.alsoIn || [])]) {
        const key = normalizeLink(x.link);
        if (!map.has(key)) map.set(key, ymd);
      }
    }
  }
  return map;
}

/** Merge freshly fetched articles into the stored file for one day */
async function mergeDay(ymd, fetched, recent = new Map()) {
  const existing = await readDaily(ymd);
  const stored = existing ? articlesOf(existing) : [];
  // Flatten stored stories back to their member articles so clustering can re-run cleanly
  const known = new Set();
  const pool = [];
  for (const a of stored) {
    const { alsoIn, ...lead } = a;
    pool.push(enrich(lead));
    known.add(normalizeLink(a.link));
    for (const x of alsoIn || []) known.add(normalizeLink(x.link));
  }
  let added = 0;
  for (const a of fetched) {
    if (dayKey(new Date(a.published)) !== ymd) continue;
    const key = normalizeLink(a.link);
    if (known.has(key)) continue;
    if (recent.has(key) && recent.get(key) !== ymd) continue;
    const e = enrich(a);
    if (e.relevanceScore < MIN_RELEVANCE_SCORE) continue;
    known.add(key);
    pool.push(e);
    added++;
  }
  // Re-attach the stored "also covered by" links so they survive re-clustering
  const restored = pool.map(p => {
    const prev = stored.find(s => normalizeLink(s.link) === normalizeLink(p.link));
    return prev?.alsoIn ? { ...p, alsoIn: prev.alsoIn } : p;
  });
  if (!restored.length) return null;
  const digest = dailyDigest(ymd, restored);
  await saveDigest(digest, 'daily');
  console.log(`     +${added} new`);
  return digest;
}

async function dailyFilesBetween(from, to) {
  const files = await fs.readdir(path.join(DATA_DIR, 'daily')).catch(() => []);
  const out = [];
  for (const f of files.filter(f => f.endsWith('.json')).sort()) {
    const ymd = `20${f.replace('.json', '')}`;
    if (ymd >= from && ymd <= to) out.push(await readJSON(path.join(DATA_DIR, 'daily', f)));
  }
  return out;
}

async function periodBody(from, to) {
  const days = await dailyFilesBetween(from, to);
  return buildDigestBody(days.flatMap(articlesOf));
}

async function weeklyDigest(week, year) {
  const start = startOfISOWeek(setISOWeek(setISOWeekYear(new Date(Date.UTC(year, 0, 10, 12)), year), week));
  const end = endOfISOWeek(start);
  const body = await periodBody(dayKey(start), dayKey(end));
  return {
    type: 'weekly',
    id: `${String(year).slice(-2)}-${week}`,
    week,
    year,
    title: `Week ${week}`,
    dateRange: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
    generatedAt: new Date().toISOString(),
    ...body
  };
}

async function monthlyDigest(date) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const body = await periodBody(dayKey(start), dayKey(end));
  return {
    type: 'monthly',
    id: format(date, 'yy-MM'),
    title: format(date, 'MMMM yyyy'),
    dateRange: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    generatedAt: new Date().toISOString(),
    ...body
  };
}

async function saveIfNotEmpty(digest, subdir) {
  if (digest.totalArticles > 0) await saveDigest(digest, subdir);
}

async function buildLastWeek(now) {
  const d = subWeeks(now, 1);
  await saveIfNotEmpty(await weeklyDigest(getISOWeek(d), getISOWeekYear(d)), 'weekly');
}

async function buildLastMonth(now) {
  await saveIfNotEmpty(await monthlyDigest(subMonths(now, 1)), 'monthly');
}

/** Rebuild every completed week and month that has daily data */
async function rebuildAll(now) {
  const files = (await fs.readdir(path.join(DATA_DIR, 'daily')).catch(() => [])).filter(f => f.endsWith('.json'));
  const weeks = new Map();
  const months = new Map();
  const thisWeekStart = dayKey(startOfISOWeek(now));
  const thisMonthStart = dayKey(startOfMonth(now));
  for (const f of files) {
    const d = dayDate(`20${f.replace('.json', '')}`);
    if (dayKey(d) < thisWeekStart) weeks.set(`${getISOWeekYear(d)}-${getISOWeek(d)}`, [getISOWeek(d), getISOWeekYear(d)]);
    if (dayKey(d) < thisMonthStart) months.set(format(d, 'yyyy-MM'), d);
  }
  console.log(`\n── Rebuilding ${weeks.size} weekly and ${months.size} monthly digests ──`);
  for (const [week, year] of weeks.values()) await saveIfNotEmpty(await weeklyDigest(week, year), 'weekly');
  for (const d of months.values()) await saveIfNotEmpty(await monthlyDigest(d), 'monthly');
}

/** Re-score and re-categorize stored daily files with the current rules */
async function rescoreAll() {
  const dir = path.join(DATA_DIR, 'daily');
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json')).sort();
  console.log(`\n── Re-scoring ${files.length} daily files ──`);
  let changed = 0;
  let total = 0;
  for (const f of files) {
    const old = await readJSON(path.join(dir, f));
    const articles = articlesOf(old).map(a => {
      const { alsoIn, ...lead } = a;
      const e = enrich(lead);
      if (e.category !== a.category) changed++;
      total++;
      return alsoIn ? { ...e, alsoIn } : e;
    });
    const digest = { ...dailyDigest(old.date, articles), generatedAt: old.generatedAt };
    await fs.writeFile(path.join(dir, f), JSON.stringify(digest, null, 2));
  }
  console.log(`  ${total} articles re-scored, ${changed} changed category`);
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

async function loadSummaries(subdir, pick) {
  const dir = path.join(DATA_DIR, subdir);
  const files = (await fs.readdir(dir).catch(() => [])).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    const d = await readJSON(path.join(dir, f));
    if (d.totalArticles > 0) out.push({ ...pick(d), totalArticles: d.totalArticles, highlightCount: d.highlights?.length || 0 });
  }
  return out;
}

async function updateIndex() {
  const daily = await loadSummaries('daily', d => ({ id: d.id, title: d.title, date: d.date, dateRange: d.dateRange }));
  const weekly = await loadSummaries('weekly', d => ({ id: d.id, title: d.title, week: d.week, year: d.year, dateRange: d.dateRange }));
  const monthly = await loadSummaries('monthly', d => ({ id: d.id, title: d.title, month: d.month, year: d.year, dateRange: d.dateRange }));
  daily.sort((a, b) => b.date.localeCompare(a.date));
  weekly.sort((a, b) => (b.year - a.year) || (b.week - a.week));
  monthly.sort((a, b) => (b.year - a.year) || (b.month - a.month));
  await fs.writeFile(path.join(DATA_DIR, 'index.json'), JSON.stringify({ lastUpdated: new Date().toISOString(), daily, weekly, monthly }, null, 2));
  console.log(`\n📋 Index: ${daily.length} daily, ${weekly.length} weekly, ${monthly.length} monthly`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseMode() {
  const args = process.argv.slice(2);
  const modes = { '--daily': 'daily', '-d': 'daily', '--weekly': 'weekly', '-w': 'weekly', '--monthly': 'monthly', '-m': 'monthly',
    '--rebuild': 'rebuild', '--rescore': 'rescore', '--backfill': 'backfill', '-b': 'backfill' };
  for (const a of args) if (modes[a]) return modes[a];
  return 'daily';
}

async function runDaily(now) {
  const articles = await fetchAllFeeds();
  if (articles.length === 0) {
    console.error('\n❌ No articles fetched. Check your internet connection.');
    process.exit(1);
  }
  console.log('\n━━━ Daily (today + yesterday, merged) ━━━');
  const recent = await recentLinks(now);
  for (const ymd of [dayKey(subDays(now, 1)), dayKey(now)]) await mergeDay(ymd, articles, recent);
  console.log('\n━━━ Last week & last month (from daily files) ━━━');
  await buildLastWeek(now);
  await buildLastMonth(now);
}

async function main() {
  const mode = parseMode();
  console.log(`Big Tech News scraper — mode: ${mode}\n`);
  for (const d of ['daily', 'weekly', 'monthly']) await fs.mkdir(path.join(DATA_DIR, d), { recursive: true });
  const now = new Date();

  switch (mode) {
    case 'daily': await runDaily(now); break;
    case 'weekly': await buildLastWeek(now); break;
    case 'monthly': await buildLastMonth(now); break;
    case 'rebuild': await rebuildAll(now); break;
    case 'rescore': await rescoreAll(); await rebuildAll(now); break;
    case 'backfill': await runDaily(now); await rebuildAll(now); break;
  }

  await updateIndex();
  console.log('\n✅ Done');
  process.exit(0);
}

if (require.main === module) {
  main().catch(error => { console.error('Fatal error:', error); process.exit(1); });
}

module.exports = { cleanAttribution, calculateRelevance, categorizeArticle, clusterArticles, normalizeLink, wordRegex, isExcluded, enrich, sanitizeXml, stripHtml, buildDigestBody };
