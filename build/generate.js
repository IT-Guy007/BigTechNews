/**
 * Static Site Generator for Big Tech News
 *
 * Pages:
 *   index.html            Home: top story, more today, this week, trending, digests
 *   search.html           Full-archive search with filters (client-side, see templates/search.js)
 *   archive.html          Calendar of every daily digest + weekly/monthly lists
 *   daily|weekly|monthly/<id>.html   Digest pages
 *   search-index.json     Every unique article, used by search.html
 */

const fs = require('fs').promises;
const path = require('path');
const { CATEGORIES, SOURCES } = require('../scraper/sources');
const { clusterArticles } = require('../scraper/index.js');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const TZ = 'Europe/Amsterdam';
const SITE_NAME = 'Big Tech News';

// Display names (shorter / clearer than the scraper's names where needed)
const CATEGORY_LABELS = {
  ai: 'AI',
  chips_cloud: 'Chips & Cloud',
  ev_autonomous: 'EVs & Autonomy',
  business: 'Business',
  space: 'Space',
  regulation: 'Regulation',
  robotics: 'Robotics',
  crypto: 'Crypto',
  devices: 'Devices',
  other: 'Uncategorized'
};
const CATEGORY_ORDER = ['ai', 'chips_cloud', 'devices', 'ev_autonomous', 'business', 'space', 'regulation', 'robotics', 'crypto'];
const TYPE_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

// ---------- helpers ----------

function render(template, data) {
  template = template.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) =>
    data[key] ? content.replace(/\{\{(\w+)\}\}/g, (__, k) => data[k] ?? '') : '');
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
}

function esc(text) {
  if (text === undefined || text === null) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clean(text) {
  if (!text) return '';
  return String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text, max) {
  const c = clean(text);
  if (c.length <= max) return c;
  return c.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

function catKey(article) {
  return article.category && CATEGORY_LABELS[article.category] ? article.category : 'other';
}

function catLabel(key) {
  return CATEGORY_LABELS[key] || CATEGORIES[key]?.name || key;
}

function safeUrl(url) {
  return /^https?:\/\//i.test(url || '') ? url : '#';
}

const fmt = (opts) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts });
const fmtTime = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });
const fmtShortDay = fmt({ weekday: 'short', month: 'short', day: 'numeric' });
const fmtLongDay = fmt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

function time(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : fmtTime.format(d);
}

function shortDay(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : fmtShortDay.format(d);
}

// "2026-11-01" -> Date at noon UTC (avoids timezone day shifts)
function dayDate(ymd) {
  return new Date(`${ymd}T12:00:00Z`);
}

function addDays(ymd, n) {
  const d = dayDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function titleKey(title) {
  return clean(title).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
}

async function readJSON(file) {
  return JSON.parse(await fs.readFile(file, 'utf-8'));
}

const searchIcon = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const chevronLeft = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>';
const chevronRight = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>';

// ---------- shared chrome ----------

function headerHTML({ root, active = '', placeholder = 'Search by company, topic or source', query = '', meta = '', showCategories = false, activeCat = '' }) {
  const metaStrip = meta ? `
    <div class="header-meta">
      <span>${meta}</span>
      <span>Updated every 2 hours</span>
    </div>` : '';

  const cats = showCategories ? `
    <nav class="cat-nav" aria-label="Categories">
      <a href="${root}search.html" class="cat-link${activeCat ? '' : ' is-active'}">All</a>
      ${CATEGORY_ORDER.map(k => `<a href="${root}search.html?cat=${k}" class="cat-link${activeCat === k ? ' is-active' : ''}">${esc(catLabel(k))}</a>`).join('')}
    </nav>` : '';

  return `
  <header class="site-header">
    <div class="container">
      ${metaStrip}
      <div class="header-main">
        <a href="${root}index.html" class="logo">${SITE_NAME}</a>
        <form class="header-search" action="${root}search.html" method="get" role="search">
          <label for="q" class="visually-hidden">Search all articles</label>
          ${searchIcon}
          <input id="q" name="q" type="search" value="${esc(query)}" placeholder="${esc(placeholder)}" autocomplete="off">
          <kbd class="search-kbd" aria-hidden="true">/</kbd>
        </form>
        <nav class="primary-nav" aria-label="Primary">
          <a href="${root}${LATEST_DIGEST_HREF}"${active === 'digests' ? ' aria-current="page"' : ''}>Digests</a>
          <a href="${root}archive.html"${active === 'archive' ? ' aria-current="page"' : ''}>Archive</a>
        </nav>
      </div>
      ${cats}
    </div>
  </header>`;
}

// set once the index is loaded (root-relative)
let LATEST_DIGEST_HREF = 'archive.html';

async function page({ root, title, description, header, content, scripts = '', bodyClass = '', footerNote = 'Curated from 15 sources, ranked by relevance.' }) {
  const layout = await fs.readFile(path.join(TEMPLATES_DIR, 'layout.html'), 'utf-8');
  return render(layout, {
    pageTitle: esc(title ? `${title} — ${SITE_NAME}` : SITE_NAME),
    description: esc(description || 'Curated big tech news ranked by relevance. Updated daily.'),
    root,
    header,
    content,
    scripts,
    bodyClass,
    footerNote: esc(footerNote)
  });
}

// ---------- article fragments ----------

// Source flags (paywall / language) by feed key and by display name; a name counts as
// paywalled when any feed with that name is (e.g. both Bloomberg feeds)
const SOURCE_BY_NAME = new Map();
for (const src of Object.values(SOURCES)) {
  const prev = SOURCE_BY_NAME.get(src.name) || {};
  SOURCE_BY_NAME.set(src.name, { paywall: prev.paywall || !!src.paywall, lang: prev.lang || src.lang || '' });
}
const LANG_NAMES = { de: 'German', nl: 'Dutch', fr: 'French', es: 'Spanish', ja: 'Japanese', zh: 'Chinese' };

function sourceFlags(a) {
  const byKey = SOURCES[a.sourceKey];
  if (byKey) return { paywall: !!byKey.paywall, lang: byKey.lang || '' };
  return SOURCE_BY_NAME.get(a.source) || { paywall: false, lang: '' };
}

/** A free outlet covering the same story, when the lead article is paywalled */
function freeAlternative(a) {
  if (!sourceFlags(a).paywall) return null;
  return (a.alsoIn || []).find(x => !(SOURCE_BY_NAME.get(x.source) || {}).paywall && /^https?:\/\//.test(x.link || '')) || null;
}

/** Badges shown after an article's meta line */
function badges(a) {
  const f = sourceFlags(a);
  const out = [];
  if (f.paywall) out.push('<span class="badge badge-paywall" title="Subscription required">Paywall</span>');
  if (f.lang) out.push(`<span class="badge" title="In ${esc(LANG_NAMES[f.lang] || f.lang)}">${esc(f.lang.toUpperCase())}</span>`);
  const free = freeAlternative(a);
  if (free) out.push(`<a class="free-alt" href="${esc(free.link)}" target="_blank" rel="noopener">Free at ${esc(free.source)}</a>`);
  const outlets = new Set((a.alsoIn || []).map(x => x.source).filter(s => s !== a.source)).size;
  if (outlets) out.push(`<span class="outlets">+${outlets} outlet${outlets > 1 ? 's' : ''}</span>`);
  return out.length ? ` <span class="badges">${out.join('')}</span>` : '';
}

const pubAttr = (a) => a.published ? ` data-published="${esc(a.published)}"` : '';

function kicker(article, extra = []) {
  const parts = [`<span class="kicker-cat">${esc(catLabel(catKey(article)))}</span>`, esc(article.source), ...extra.filter(Boolean).map(esc)];
  return `<div class="kicker">${parts.join(' · ')}${badges(article)}</div>`;
}

function storyLink(article, cls = 'hl') {
  return `<a class="${cls}" href="${esc(safeUrl(article.link))}" target="_blank" rel="noopener">${esc(clean(article.title))}</a>`;
}

function rankedList(articles, { start = 1, withDesc = false, dayLabel = false } = {}) {
  return `<ol class="ranked">${articles.map((a, i) => `
    <li class="ranked-item"${pubAttr(a)}>
      <span class="ranked-num">${start + i}</span>
      <div class="ranked-body">
        ${withDesc ? kicker(a, [dayLabel ? shortDay(a.published) : time(a.published)]) : ''}
        <h3 class="ranked-title">${storyLink(a)}</h3>
        ${withDesc && a.description ? `<p class="ranked-desc">${esc(truncate(a.description, 220))}</p>` : ''}
        ${withDesc ? '' : `<div class="meta">${esc(catLabel(catKey(a)))} · ${esc(a.source)} · ${dayLabel ? shortDay(a.published) : time(a.published)}${badges(a)}</div>`}
      </div>
    </li>`).join('')}</ol>`;
}

function sectionHead(title, right = '', id = '') {
  return `<div class="section-head"><h2${id ? ` id="${id}"` : ''} class="section-title">${title}</h2>${right}</div>`;
}

// ---------- home ----------

// Trending = keywords that appear as a capitalised whole word in titles (proper nouns:
// companies, products, people). The scraper's raw keyword matches are too noisy
// ("intel" also fires on "intelligence", generic words like "billion").
const TRENDING_SKIP = new Set(['ai', 'artificial intelligence', 'billion', 'chip', 'chips', 'ceo', 'ipo', 'trillion']);
function keywordInTitle(title, kw) {
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:'s|’s|s)?(?![\\p{L}\\p{N}])`, 'iu');
  const m = re.exec(title);
  if (!m) return false;
  const start = m.index + m[1].length;
  const first = title[start];
  return first === first.toUpperCase() && first !== first.toLowerCase() ? title.substr(start, kw.length) : false;
}

function articleKeywords(a) {
  return [...new Set((a.matchedKeywords || []).map(k => k.toLowerCase()))]
    .filter(k => !TRENDING_SKIP.has(k) && keywordInTitle(clean(a.title), k));
}

function computeTrending(articles, limit = 8) {
  const counts = new Map();
  const labels = new Map();
  for (const a of articles) {
    for (const k of articleKeywords(a)) {
      counts.set(k, (counts.get(k) || 0) + 1);
      if (!labels.has(k)) labels.set(k, keywordInTitle(clean(a.title), k));
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, n]) => ({ label: labels.get(k) || k, q: k, n }));
}

async function generateIndexPage(index, latestDaily, weekArticles, weekRange) {
  const root = '';
  const highlights = (latestDaily?.highlights || []).map(a => ({ ...a, title: clean(a.title) }));
  const lead = highlights[0];
  const second = highlights.slice(1, 3);
  const more = highlights.slice(3, 10);
  const dailyHref = index.daily[0] ? `daily/${index.daily[0].id}.html` : 'archive.html';

  let leadHTML = '<p class="empty">No stories yet today.</p>';
  if (lead) {
    const tags = articleKeywords(lead).slice(0, 3)
      .map(k => `<a class="tag" href="search.html?q=${encodeURIComponent(k)}">${esc(k)}</a>`).join('');
    leadHTML = `
      <article class="lead"${pubAttr(lead)}>
        <div class="kicker"><span class="kicker-cat">Top story · ${esc(catLabel(catKey(lead)))}</span> · ${esc(lead.source)} · ${time(lead.published)}${badges(lead)}</div>
        <h1 class="lead-title">${storyLink(lead)}</h1>
        ${lead.description ? `<p class="lead-desc">${esc(truncate(lead.description, 260))}</p>` : ''}
        ${tags ? `<div class="tags">${tags}</div>` : ''}
      </article>`;
  }

  const secondHTML = second.length ? `
      <div class="second-grid">${second.map(a => `
        <article class="second"${pubAttr(a)}>
          ${kicker(a, [time(a.published)])}
          <h2 class="second-title">${storyLink(a)}</h2>
          ${a.description ? `<p class="second-desc">${esc(truncate(a.description, 180))}</p>` : ''}
        </article>`).join('')}
      </div>` : '';

  const moreHTML = more.length ? `
      <section aria-labelledby="more-today">
        ${sectionHead('More today', `<a class="more-link" href="${dailyHref}">Full daily digest →</a>`, 'more-today')}
        ${rankedList(more, { start: 4 })}
      </section>` : '';

  const weekHTML = weekArticles.length ? `
      <section aria-labelledby="this-week">
        ${sectionHead('This week', `<span class="section-aside">${esc(weekRange)}</span>`, 'this-week')}
        <ol class="rail-list">${weekArticles.slice(0, 5).map(a => `
          <li class="rail-item"${pubAttr(a)}>
            <span class="meta">${esc(shortDay(a.published))} · ${esc(a.source)}${badges(a)}</span>
            ${storyLink(a, 'hl rail-title')}
          </li>`).join('')}
        </ol>
      </section>` : '';

  const trending = computeTrending(weekArticles);
  const trendHTML = trending.length ? `
      <section aria-labelledby="trending">
        ${sectionHead('Trending this week', '', 'trending')}
        <div class="chips">${trending.map(t => `<a class="chip" href="search.html?q=${encodeURIComponent(t.q)}&amp;range=7d">${esc(t.label)} <span class="chip-count">${t.n}</span></a>`).join('')}</div>
      </section>` : '';

  const digestRows = [];
  if (index.daily[1]) digestRows.push({ kind: 'Yesterday', title: index.daily[1].title, n: index.daily[1].totalArticles, href: `daily/${index.daily[1].id}.html` });
  if (index.weekly[0]) digestRows.push({ kind: 'Weekly', title: `${index.weekly[0].title} · ${index.weekly[0].dateRange.replace(/, \d{4}$/, '')}`, n: index.weekly[0].totalArticles, href: `weekly/${index.weekly[0].id}.html` });
  if (index.monthly[0]) digestRows.push({ kind: 'Monthly', title: index.monthly[0].title, n: index.monthly[0].totalArticles, href: `monthly/${index.monthly[0].id}.html` });

  const digestsHTML = `
      <section aria-labelledby="digests">
        ${sectionHead('Digests', '', 'digests')}
        ${digestRows.map(d => `
        <a class="row-link" href="${d.href}">
          <span class="row-main"><span class="meta">${esc(d.kind)}</span><span class="row-title">${esc(d.title)}</span></span>
          <span class="meta">${d.n} articles</span>
        </a>`).join('')}
        <a class="more-link block" href="archive.html">Browse the full archive →</a>
      </section>`;

  const updated = new Date(index.lastUpdated);
  const meta = latestDaily
    ? `${esc(fmtLongDay.format(dayDate(latestDaily.date)))} · Updated ${fmtTime.format(updated)} CET`
    : 'No digests yet';

  const content = `
  <main id="main" class="container layout-split">
    <div class="col-main">
      <div class="new-banner" id="new-banner" hidden>
        <span id="new-banner-text"></span>
        <button type="button" class="link-btn" id="mark-read">Mark all as read</button>
      </div>
      ${leadHTML}
      ${secondHTML}
      ${moreHTML}
    </div>
    <aside class="col-rail">
      ${weekHTML}
      ${trendHTML}
      ${digestsHTML}
    </aside>
  </main>`;

  return page({
    root,
    title: '',
    header: headerHTML({ root, meta, showCategories: true, placeholder: `Search ${SEARCH_COUNT_LABEL} articles by company, topic or source` }),
    content
  });
}

let SEARCH_COUNT_LABEL = 'all';

// ---------- digest pages ----------

function neighbours(list, id) {
  const i = list.findIndex(x => x.id === id);
  // list is newest first: "previous" in time is i+1
  return { prev: list[i + 1] || null, next: i > 0 ? list[i - 1] : null };
}

function rangeForDigest(digest, type) {
  if (type === 'daily') return { from: digest.date, to: digest.date };
  if (type === 'monthly') {
    const m = String(digest.month).padStart(2, '0');
    const last = new Date(Date.UTC(digest.year, digest.month, 0)).getUTCDate();
    return { from: `${digest.year}-${m}-01`, to: `${digest.year}-${m}-${String(last).padStart(2, '0')}` };
  }
  // weekly: parse "Oct 19 – Oct 25, 2026"
  const m = /^(\w{3}) (\d+) – (\w{3}) (\d+), (\d{4})$/.exec(digest.dateRange || '');
  if (!m) return null;
  const mon = s => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(s) + 1;
  const y = Number(m[5]);
  const fromY = mon(m[1]) > mon(m[3]) ? y - 1 : y;
  const p = n => String(n).padStart(2, '0');
  return { from: `${fromY}-${p(mon(m[1]))}-${p(m[2])}`, to: `${y}-${p(mon(m[3]))}-${p(m[4])}` };
}

async function generateDigestPage(digest, type, index) {
  const root = '../';
  const list = index[type];
  const { prev, next } = neighbours(list, digest.id);
  const highlights = (digest.highlights || []).map(a => ({ ...a, title: clean(a.title) }));
  const highlightKeys = new Set(highlights.map(a => titleKey(a.title)));
  const range = rangeForDigest(digest, type);
  const rangeQS = range ? `&amp;from=${range.from}&amp;to=${range.to}` : '';

  const sections = Object.entries(digest.byCategory || {})
    .map(([k, arts]) => [CATEGORY_LABELS[k] ? k : 'other', arts])
    .filter(([, arts]) => arts.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  const typeTabs = ['daily', 'weekly', 'monthly'].map(t => {
    const target = index[t][0];
    const href = t === type ? `${digest.id}.html` : target ? `${root}${t}/${target.id}.html` : `${root}archive.html`;
    return `<a href="${href}" class="seg${t === type ? ' is-active' : ''}"${t === type ? ' aria-current="page"' : ''}>${TYPE_LABELS[t]}</a>`;
  }).join('');

  const navBtn = (item, dir) => item
    ? `<a class="btn" href="${item.id}.html">${dir === 'prev' ? `${chevronLeft}<span>${esc(item.title)}</span>` : `<span>${esc(item.title)}</span>${chevronRight}`}</a>`
    : `<span class="btn is-disabled" aria-disabled="true">${dir === 'prev' ? `${chevronLeft}<span>Oldest</span>` : `<span>Latest</span>${chevronRight}`}</span>`;

  const toc = `
    <nav class="toc" aria-label="On this page">
      <span class="toc-title">On this page</span>
      <a href="#top" class="toc-link">Top ${highlights.length}<span class="meta">${highlights.length}</span></a>
      ${sections.map(([k, arts]) => `<a href="#cat-${k}" class="toc-link">${esc(catLabel(k))}<span class="meta">${arts.length}</span></a>`).join('')}
    </nav>`;

  const topHTML = highlights.length ? `
      <section id="top" aria-labelledby="top-title">
        ${sectionHead(`Top ${highlights.length}${type === 'daily' ? ' today' : type === 'weekly' ? ' this week' : ' this month'}`, '', 'top-title')}
        ${rankedList(highlights, { withDesc: true, dayLabel: type !== 'daily' })}
      </section>` : '<p class="empty">No highlights.</p>';

  const sectionsHTML = sections.map(([k, arts]) => {
    const rest = arts.filter(a => !highlightKeys.has(titleKey(a.title)));
    const shown = (rest.length ? rest : arts).slice(0, 8);
    return `
      <section id="cat-${k}" class="cat-section">
        ${sectionHead(`${esc(catLabel(k))} <span class="count">${arts.length}</span>`, `<a class="more-link" href="${root}search.html?cat=${k}${rangeQS}">All ${arts.length} in search →</a>`)}
        <ul class="cat-grid">${shown.map(a => `
          <li class="cat-item"${pubAttr(a)}>
            ${storyLink(a, 'hl cat-title')}
            <span class="meta">${esc(a.source)}${type !== 'daily' ? ` · ${esc(shortDay(a.published))}` : ''}${badges(a)}</span>
          </li>`).join('')}
        </ul>
      </section>`;
  }).join('');

  const searchPlaceholder = `Search within ${digest.title}`;
  const formHidden = range ? `<input type="hidden" name="from" value="${range.from}"><input type="hidden" name="to" value="${range.to}">` : '';

  const content = `
  <div class="digest-hero">
    <div class="container digest-hero-inner">
      <div class="digest-controls">
        <nav class="segmented" aria-label="Digest type">${typeTabs}</nav>
        <nav class="pager" aria-label="Other ${type} digests">${navBtn(prev, 'prev')}${navBtn(next, 'next')}</nav>
      </div>
      <div>
        <span class="eyebrow">${TYPE_LABELS[type]} digest</span>
        <h1 class="digest-title">${esc(digest.title)}</h1>
        <p class="digest-sub">${esc(digest.dateRange)} · ${digest.totalArticles || 0} articles · ${highlights.length} highlights</p>
      </div>
    </div>
  </div>
  <main id="main" class="container layout-toc">
    ${toc}
    <div class="col-main">
      ${topHTML}
      ${sectionsHTML}
    </div>
  </main>`;

  const html = await page({
    root,
    title: `${digest.title} · ${TYPE_LABELS[type]} digest`,
    description: `${TYPE_LABELS[type]} big tech digest for ${digest.dateRange}.`,
    header: headerHTML({ root, active: 'digests', placeholder: searchPlaceholder }),
    content,
    footerNote: `Generated ${fmtLongDay.format(new Date(digest.generatedAt))}`
  });
  // carry the digest's date range into the header search
  return html.replace('</label>', `</label>${formHidden}`);
}

// ---------- archive ----------

function heatClass(n) {
  return n >= 50 ? 'heat-4' : n >= 30 ? 'heat-3' : n >= 10 ? 'heat-2' : 'heat-1';
}

async function generateArchivePage(index) {
  const root = '';
  const byMonth = new Map();
  for (const d of index.daily) {
    const key = d.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, new Map());
    byMonth.get(key).set(d.date, d);
  }
  const monthly = new Map(index.monthly.map(m => [`${m.year}-${String(m.month).padStart(2, '0')}`, m]));
  const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dayAria = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  const calendars = [...byMonth.entries()].map(([ym, days]) => {
    const [y, m] = ym.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7; // Monday first
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell is-blank"></span>');
    for (let d = 1; d <= count; d++) {
      const ymd = `${ym}-${String(d).padStart(2, '0')}`;
      const info = days.get(ymd);
      if (info) {
        cells.push(`<a class="cal-cell ${heatClass(info.totalArticles)}" href="daily/${info.id}.html" aria-label="${esc(dayAria.format(dayDate(ymd)))}, ${info.totalArticles} articles"><span class="cal-day">${d}</span><span class="cal-n">${info.totalArticles}</span></a>`);
      } else {
        cells.push(`<span class="cal-cell is-empty"><span class="cal-day">${d}</span></span>`);
      }
    }
    const mo = monthly.get(ym);
    return `
      <section class="cal" id="m-${ym}" aria-labelledby="cal-${ym}">
        <div class="cal-head">
          <h2 id="cal-${ym}" class="cal-title">${esc(monthFmt.format(first))}</h2>
          ${mo ? `<a class="more-link" href="monthly/${mo.id}.html">Monthly digest · ${mo.totalArticles} articles →</a>` : ''}
        </div>
        <div class="cal-grid cal-dow" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
        <div class="cal-grid">${cells.join('')}</div>
      </section>`;
  }).join('');

  const legend = `
    <div class="legend"><span>Articles per day</span>
      <span class="legend-item"><span class="swatch heat-1"></span>under 10</span>
      <span class="legend-item"><span class="swatch heat-2"></span>10–29</span>
      <span class="legend-item"><span class="swatch heat-3"></span>30–49</span>
      <span class="legend-item"><span class="swatch heat-4"></span>50+</span>
    </div>`;

  const weekRow = (w) => `
          <a class="row-link" href="weekly/${w.id}.html">
            <span class="row-main"><span class="row-title">${esc(w.title)}</span><span class="meta">${esc(w.dateRange)}</span></span>
            <span class="meta">${w.totalArticles} articles</span>
          </a>`;
  const first = index.daily[index.daily.length - 1];
  const content = `
  <main id="main" class="container archive">
    <div class="page-intro">
      <h1 class="page-title">Archive</h1>
      <p class="page-sub">Every daily, weekly and monthly digest${first ? ` since ${esc(fmtLongDay.format(dayDate(first.date)).replace(/^\w+, /, ''))}` : ''}. Pick a day to open its digest.</p>
    </div>
    <div class="layout-split">
      <div class="col-main cal-stack">
        ${legend}
        <div class="cal-columns">${calendars || '<p class="empty">No digests yet.</p>'}</div>
      </div>
      <aside class="col-rail">
        <section aria-labelledby="wk">
          ${sectionHead('Weekly digests', '', 'wk')}
          ${index.weekly.slice(0, 8).map(weekRow).join('')}
          ${index.weekly.length > 8 ? `<details class="more-rows"><summary class="more-link">All ${index.weekly.length} weekly digests</summary>${index.weekly.slice(8).map(weekRow).join('')}</details>` : ''}
        </section>
        <section aria-labelledby="mo">
          ${sectionHead('Monthly digests', '', 'mo')}
          ${index.monthly.map(m => `
          <a class="row-link" href="monthly/${m.id}.html">
            <span class="row-title">${esc(m.title)}</span>
            <span class="meta">${m.totalArticles} articles</span>
          </a>`).join('')}
        </section>
      </aside>
    </div>
  </main>`;

  return page({
    root,
    title: 'Archive',
    header: headerHTML({ root, active: 'archive' }),
    content
  });
}

// ---------- search ----------

async function buildSearchIndex(index) {
  const seen = new Set();
  const items = [];
  // oldest first so the first-seen digest day is kept for duplicates
  for (const info of [...index.daily].reverse()) {
    let digest;
    try { digest = await readJSON(path.join(DATA_DIR, 'daily', `${info.id}.json`)); } catch { continue; }
    const all = [...(digest.highlights || []), ...Object.values(digest.byCategory || {}).flat()];
    for (const a of all) {
      const key = a.link || titleKey(a.title);
      if (!a.title || seen.has(key)) continue;
      seen.add(key);
      items.push({
        t: clean(a.title),
        x: truncate(a.description, 150),
        s: a.source || '',
        c: catKey(a),
        u: safeUrl(a.link),
        p: a.published ? a.published.slice(0, 16) : '',
        d: digest.date,
        r: a.relevanceScore || 0
      });
      const item = items[items.length - 1];
      const f = sourceFlags(a);
      if (f.paywall) item.w = 1;
      if (f.lang) item.l = f.lang;
      const free = freeAlternative(a);
      if (free) item.f = { s: free.source, u: free.link };
    }
  }
  return items;
}

async function generateSearchPage(index) {
  const root = '';
  const latest = index.daily[0]?.date || new Date().toISOString().slice(0, 10);
  const content = `
  <main id="main" class="container search-layout" data-latest="${latest}" data-labels='${esc(JSON.stringify(CATEGORY_LABELS))}'>
    <details class="filters" open>
      <summary class="filters-toggle">Filters</summary>
      <div class="filters-body">
        <fieldset class="filter-group">
          <legend>Date</legend>
          <div id="f-range"></div>
        </fieldset>
        <fieldset class="filter-group">
          <legend>Category</legend>
          <div id="f-cat"></div>
        </fieldset>
        <fieldset class="filter-group">
          <legend>Source</legend>
          <div id="f-src"></div>
        </fieldset>
      </div>
    </details>
    <section class="results" aria-label="Results">
      <div class="results-head">
        <h1 class="results-title" id="results-title" aria-live="polite">Loading articles…</h1>
        <div class="segmented" role="group" aria-label="Sort">
          <button type="button" class="seg" data-sort="rel">Most relevant</button>
          <button type="button" class="seg" data-sort="new">Newest</button>
        </div>
      </div>
      <div class="active-chips" id="active-chips"></div>
      <ol class="result-list" id="result-list"></ol>
      <p class="empty" id="no-results" hidden>No articles match. Try a broader date range, or remove a filter.</p>
      <button type="button" class="btn btn-wide" id="show-more" hidden>Show more</button>
      <noscript><p class="empty">Search needs JavaScript. Browse the <a href="archive.html">archive</a> instead.</p></noscript>
    </section>
  </main>`;

  return page({
    root,
    title: 'Search',
    header: headerHTML({ root, placeholder: `Search ${SEARCH_COUNT_LABEL} articles by company, topic or source`, showCategories: false }),
    content,
    scripts: `<script src="${root}js/search.js" defer></script>`
  });
}

// ---------- build ----------

async function build() {
  console.log('Building site...\n');

  for (const dir of ['css', 'js', 'daily', 'weekly', 'monthly']) {
    await fs.mkdir(path.join(PUBLIC_DIR, dir), { recursive: true });
  }

  await fs.copyFile(path.join(TEMPLATES_DIR, 'styles.css'), path.join(PUBLIC_DIR, 'css', 'styles.css'));
  await fs.copyFile(path.join(TEMPLATES_DIR, 'site.js'), path.join(PUBLIC_DIR, 'js', 'site.js'));
  await fs.copyFile(path.join(TEMPLATES_DIR, 'search.js'), path.join(PUBLIC_DIR, 'js', 'search.js'));
  console.log('✓ css + js');

  let index;
  try {
    index = await readJSON(path.join(DATA_DIR, 'index.json'));
  } catch {
    index = { lastUpdated: new Date().toISOString(), daily: [], weekly: [], monthly: [] };
  }
  if (index.daily[0]) LATEST_DIGEST_HREF = `daily/${index.daily[0].id}.html`;

  // Search index (all unique articles)
  const searchItems = await buildSearchIndex(index);
  SEARCH_COUNT_LABEL = searchItems.length >= 1000
    ? `${(Math.floor(searchItems.length / 1000) * 1000).toLocaleString('en-US')}+`
    : String(searchItems.length);
  await fs.writeFile(path.join(PUBLIC_DIR, 'search-index.json'), JSON.stringify(searchItems));
  console.log(`✓ search-index.json (${searchItems.length} articles)`);

  // Latest daily + last 7 days for the home page
  let latestDaily = null;
  if (index.daily[0]) {
    try { latestDaily = await readJSON(path.join(DATA_DIR, 'daily', `${index.daily[0].id}.json`)); } catch {}
  }
  let weekArticles = [];
  let weekRange = '';
  if (latestDaily) {
    const from = addDays(latestDaily.date, -6);
    const seen = new Set();
    for (const info of index.daily.filter(d => d.date >= from)) {
      try {
        const digest = await readJSON(path.join(DATA_DIR, 'daily', `${info.id}.json`));
        for (const a of [...(digest.highlights || []), ...Object.values(digest.byCategory || {}).flat()]) {
          const k = titleKey(a.title);
          if (seen.has(k)) continue;
          seen.add(k);
          weekArticles.push({ ...a, title: clean(a.title) });
        }
      } catch {}
    }
    // the same story often lands on two different days; merge across the week
    weekArticles = clusterArticles(weekArticles);
    weekArticles.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0) || String(b.published).localeCompare(String(a.published)));
    const short = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    weekRange = `${short.format(dayDate(from))} – ${short.format(dayDate(latestDaily.date))}`;
  }
  console.log(`✓ Last 7 days: ${weekArticles.length} articles`);

  // LATEST_DIGEST_HREF is root-relative; header prefixes root
  await fs.writeFile(path.join(PUBLIC_DIR, 'index.html'), await generateIndexPage(index, latestDaily, weekArticles, weekRange));
  console.log('✓ index.html');
  await fs.writeFile(path.join(PUBLIC_DIR, 'search.html'), await generateSearchPage(index));
  console.log('✓ search.html');
  await fs.writeFile(path.join(PUBLIC_DIR, 'archive.html'), await generateArchivePage(index));
  console.log('✓ archive.html');

  let count = 0;
  for (const type of ['daily', 'weekly', 'monthly']) {
    for (const info of index[type]) {
      try {
        const digest = await readJSON(path.join(DATA_DIR, type, `${info.id}.json`));
        await fs.writeFile(path.join(PUBLIC_DIR, type, `${digest.id}.html`), await generateDigestPage(digest, type, index));
        count++;
      } catch (e) {
        console.error(`✗ ${type}/${info.id}: ${e.message}`);
      }
    }
  }
  console.log(`✓ ${count} digest pages`);

  console.log('\n✅ Done');
  process.exit(0);
}

if (require.main === module) {
  build().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { sourceFlags, freeAlternative, badges, computeTrending, keywordInTitle, catKey };
