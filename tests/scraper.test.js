/**
 * Regression tests for scoring, filtering, categorizing and dedup.
 * Every case here is a real headline that was handled wrongly at some point.
 * Run with: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  cleanAttribution, calculateRelevance, categorizeArticle, clusterArticles, normalizeLink,
  wordRegex, isExcluded, enrich, sanitizeXml, buildDigestBody
} = require('../scraper/index.js');
const { SOURCES, CATEGORIES } = require('../scraper/sources');

const article = (title, extra = {}) => ({
  title,
  description: '',
  link: `https://example.com/${encodeURIComponent(title).slice(0, 60)}`,
  source: 'CNBC',
  sourceKey: 'cnbc_tech',
  priority: 1,
  published: '2026-11-02T10:00:00.000Z',
  ...extra
});
const score = (title, extra) => calculateRelevance(article(title, extra)).score;
const category = (title, extra) => categorizeArticle(article(title, extra));

test('keywords match whole words only', () => {
  const cases = [
    ['ai', 'He said it again', false],
    ['ai', "AI's new model", true],
    ['ev', 'Every device ships today', false],
    ['ev', 'EVs are selling', true],
    ['intel', 'Artificial intelligence spending', false],
    ['intel', "Intel's CEO steps down", true],
    ['meta', 'Metadata leak exposes users', false],
    ['meta', "Meta's ad business grows", true],
    ['arm holdings', 'Robot arm holds a cup', false],
    ['gpt', 'GPT-6 launches', true]
  ];
  for (const [kw, text, expected] of cases) {
    assert.equal(wordRegex(kw).test(text.toLowerCase()), expected, `${kw} in "${text}"`);
  }
});

test('shopping, reviews, how-tos and puzzles are excluded', () => {
  for (const t of [
    'Weekend Apple deals: Apple Watch Ultra 4, AirTag 2, MacBooks, more',
    'Deals: AirPods Pro 3, MacBook Air $200 off, more',
    'Apple TV 4K Pre-Order Discount Returns at Amazon',
    "Apple Watch Ultra 4 Hits All-Time Low Price With Amazon's $99 Discount",
    "Google's latest Nest Learning Thermostat is a steal with new limited-time deal",
    'Best Chromebooks and Googlebooks (2026): Laptops With a Google Touch',
    'How to add and rearrange apps on your Samsung smart TV',
    'Pixel 11 review: the best Android phone',
    "Today's Wordle hints and answer"
  ]) {
    assert.ok(isExcluded(t), `should exclude: ${t}`);
    assert.equal(score(t), 0, `should score 0: ${t}`);
  }
});

test('real business news is not excluded', () => {
  for (const t of [
    'OpenAI deepens Abu Dhabi foothold as Sam Altman inks deals spanning energy, government and investment',
    "OpenAI's Altman Signs Energy, Investment Deals in the UAE",
    'Rivian electric van spotted in Walmart+ livery, hinting at a fleet deal',
    'Apple and OpenAI trade secrets lawsuit now has an official trial date',
    'Hackers breach Microsoft cloud accounts in major hack',
    'EU budget sets aside billions for chip factories',
    'Apple vs. Epic: Supreme Court declines appeal'
  ]) {
    assert.equal(isExcluded(t), false, `should not exclude: ${t}`);
    assert.ok(score(t) >= 3, `should pass the threshold: ${t} (got ${score(t)})`);
  }
});

test('minor updates are penalized, not banned', () => {
  const minor = score('Google Messages update rolling out new app icon');
  const plain = score('Google Messages gets new app icon design');
  assert.equal(plain - minor, 4);
  assert.ok(score('OpenAI GPT-6 now available to all ChatGPT users') >= 3, 'a big launch survives the penalty');
});

test('broad feeds need a tracked company or high-impact keyword', () => {
  const general = { sourceKey: 'cnbc_top', source: 'CNBC' };
  assert.equal(score('Crude prices slide as investors brace for a big week', general), 0);
  assert.equal(score('TIPS Are Perfect Hedge for AI, Says BMO’s Davis', { sourceKey: 'bloomberg_markets', source: 'Bloomberg' }), 0);
  assert.ok(score('Nvidia shares jump after earnings beat', general) >= 3);
  assert.equal(score('Show HN: my Rust database', { sourceKey: 'hackernews', source: 'Hacker News', priority: 2 }), 0);
});

test('official newsrooms are credited with their own company', () => {
  const r = calculateRelevance(article('Introducing GPT-6', { sourceKey: 'openai_news', source: 'OpenAI' }));
  assert.ok(r.score >= 3);
  assert.ok(r.reasons.includes('openai'));
  assert.equal(category('Introducing GPT-6', { sourceKey: 'openai_news' }), 'ai');
});

test('categories', () => {
  const cases = [
    ['Tesla is ditching its solar roof tiles for a good reason', 'ev_autonomous'],
    ['Waymo taps Toyota to supply robotaxis for Japan and the U.K.', 'ev_autonomous'],
    ['Amazon made the AUX input on older Alexa devices less useful', 'devices'],
    ['Apple Debuts $699 Water-Resistant iPad Mini With OLED Screen', 'devices'],
    ['Apple and DOJ notify court of impasse over document cutoff in antitrust lawsuit', 'regulation'],
    ['Starlink seems to be working normally again in Ukraine', 'space'],
    ['Nvidia discusses $2,000-per-GPU annual fee for software', 'chips_cloud'],
    ['Bitcoin stolen from Binance tops Tesla’s holdings', 'crypto'],
    ['DeepSeek Drops Enhanced Coding Agent With Aim to Rival Anthropic', 'ai'],
    ['Tesla pushes Optimus deliveries to late 2027, says hands still a problem', 'robotics'],
    ['Free video editor inside Google Drive that anyone can use', 'other']
  ];
  for (const [t, expected] of cases) assert.equal(category(t), expected, t);
});

test('every category key has a site label', () => {
  const labels = ['ai', 'chips_cloud', 'ev_autonomous', 'business', 'space', 'regulation', 'robotics', 'crypto', 'devices', 'other'];
  for (const k of Object.keys(CATEGORIES)) assert.ok(labels.includes(k), `missing site label for ${k}`);
});

test('same story from different outlets is merged and boosted', () => {
  const a = enrich(article('DoorDash acquires Instacart in $17 billion delivery service merger', { source: 'TechCrunch', sourceKey: 'techcrunch', link: 'https://techcrunch.com/doordash' }));
  const b = enrich(article('DoorDash is acquiring Instacart for $17 billion', { source: 'The Verge', sourceKey: 'theverge', link: 'https://theverge.com/doordash' }));
  const c = enrich(article('Apple Debuts $699 Water-Resistant iPad Mini', { source: 'Bloomberg', sourceKey: 'bloomberg_tech', link: 'https://bloomberg.com/ipad' }));
  const out = clusterArticles([a, b, c]);
  assert.equal(out.length, 2);
  const merged = out.find(x => x.alsoIn);
  assert.equal(merged.alsoIn.length, 1);
  assert.equal(merged.relevanceScore, merged.baseScore + 1);
});

test('different stories about the same company are not merged', () => {
  const a = enrich(article('Anthropic files for blockbuster IPO', { link: 'https://x.com/1' }));
  const b = enrich(article('Anthropic launches Claude Duet assistant', { link: 'https://x.com/2' }));
  assert.equal(clusterArticles([a, b]).length, 2);
});

test('links are normalized before dedup', () => {
  assert.equal(
    normalizeLink('https://www.example.com/story/?utm_source=rss&utm_medium=feed#comments'),
    normalizeLink('https://example.com/story')
  );
  assert.notEqual(normalizeLink('https://example.com/a?id=1'), normalizeLink('https://example.com/a?id=2'));
});

test('malformed XML entities are repaired', () => {
  assert.equal(sanitizeXml('<t>AT&T & Verizon &amp; T-Mobile &#8217;</t>'), '<t>AT&amp;T &amp; Verizon &amp; T-Mobile &#8217;</t>');
});

test('digest body keeps every article, highlights are the top 10', () => {
  const words = ['apple', 'nvidia', 'tesla', 'openai', 'google', 'amazon', 'microsoft', 'meta', 'intel', 'samsung', 'spacex', 'uber', 'netflix', 'oracle'];
  const topics = ['earnings', 'lawsuit', 'chip', 'robotaxi', 'model', 'cloud', 'layoffs', 'headset', 'foundry', 'phone', 'starship', 'ipo', 'pricing', 'database'];
  const arts = words.map((w, i) => enrich(article(`${w} ${topics[i]} update ${i}`, { link: `https://e.com/${i}` })));
  const body = buildDigestBody(arts);
  assert.equal(body.highlights.length, 10);
  assert.equal(Object.values(body.byCategory).flat().length, body.totalArticles);
});

test('source config is valid', () => {
  const names = new Set();
  for (const [key, s] of Object.entries(SOURCES)) {
    assert.match(s.rss, /^https:\/\//, `${key} rss`);
    assert.ok([1, 2, 3].includes(s.priority), `${key} priority`);
    assert.ok(s.name, `${key} name`);
    if (s.lang) assert.match(s.lang, /^[a-z]{2}$/, `${key} lang`);
    names.add(s.name);
  }
  assert.ok(Object.keys(SOURCES).length >= 40);
});

test('aggregator bylines are stripped from titles and descriptions', () => {
  const a = cleanAttribution({
    title: 'Marvell agrees to acquire Lumentum in a $115B all-stock deal (Anhata Rooprai/Reuters)',
    description: 'Anhata Rooprai / Reuters: Marvell agrees to acquire optical components maker Lumentum'
  });
  assert.equal(a.title, 'Marvell agrees to acquire Lumentum in a $115B all-stock deal');
  assert.equal(a.description, 'Marvell agrees to acquire optical components maker Lumentum');
  assert.equal(a.via, 'Reuters');
  const plain = { title: 'Apple (AAPL) earnings beat', description: 'x' };
  assert.deepEqual(cleanAttribution(plain), plain, 'tickers in parentheses are left alone');
});

test('the same story on different days is merged in weekly views', () => {
  const a = enrich(article('DeepSeek unveils AI ‘super agent’ in coding race with OpenAI, Anthropic', { source: 'SCMP', sourceKey: 'scmp_tech', link: 'https://scmp.com/d', published: '2026-11-01T08:00:00Z' }));
  const b = enrich(article('DeepSeek Unveils Autonomous Coding Agent Prototype', { source: 'The Information', sourceKey: 'theinformation', link: 'https://ti.com/d', published: '2026-11-02T06:55:00Z' }));
  assert.equal(clusterArticles([a, b]).length, 1);
});
