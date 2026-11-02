// Big Tech News — client-side search over search-index.json
(function () {
  const main = document.querySelector('.search-layout');
  if (!main) return;

  const LABELS = JSON.parse(main.dataset.labels || '{}');
  const LATEST = main.dataset.latest;
  const PAGE = 20;
  const TZ = 'Europe/Amsterdam';
  const fmtDay = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
  const fmtYear = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtShort = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  const thisYear = LATEST ? LATEST.slice(0, 4) : String(new Date().getFullYear());

  const $ = (id) => document.getElementById(id);
  const input = $('q');
  const form = input && input.form;
  const els = {
    title: $('results-title'), list: $('result-list'), none: $('no-results'), more: $('show-more'),
    chips: $('active-chips'), range: $('f-range'), cat: $('f-cat'), src: $('f-src')
  };

  // ---------- state <-> URL ----------
  const params = new URLSearchParams(location.search);
  const split = (v) => (v ? v.split(',').filter(Boolean) : []);
  const state = {
    q: params.get('q') || '',
    cats: split(params.get('cat')),
    srcs: split(params.get('src')),
    range: params.get('range') || 'all',
    from: params.get('from') || '',
    to: params.get('to') || '',
    sort: params.get('sort') || '',
    limit: PAGE
  };
  if (state.from || state.to) state.range = 'custom';
  if (input) input.value = state.q;

  function syncURL() {
    const p = new URLSearchParams();
    if (state.q.trim()) p.set('q', state.q.trim());
    if (state.cats.length) p.set('cat', state.cats.join(','));
    if (state.srcs.length) p.set('src', state.srcs.join(','));
    if (state.range === 'custom') { if (state.from) p.set('from', state.from); if (state.to) p.set('to', state.to); }
    else if (state.range !== 'all') p.set('range', state.range);
    if (state.sort) p.set('sort', state.sort);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  // ---------- helpers ----------
  function addDays(ymd, n) {
    const d = new Date(`${ymd}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const isWordChar = (c) => /[\p{L}\p{N}]/u.test(c);
  function normalize(s) {
    return s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  }
  function tokens(q) {
    return normalize(q).replace(/["]/g, ' ').split(/\s+/).filter((t) => t.length > 0);
  }
  // Whole-word matching: "intel" matches "Intel" and "Intel's", never "intelligence".
  // A token marked as prefix (the word still being typed) matches word starts instead.
  const SUFFIX = /^(?:s|es|'s)(?![\p{L}\p{N}])/u;
  function wordStarts(hay, tok, prefix) {
    const hits = [];
    let i = hay.indexOf(tok);
    while (i !== -1) {
      if (i === 0 || !isWordChar(hay[i - 1])) {
        const end = i + tok.length;
        if (prefix || end >= hay.length || !isWordChar(hay[end]) || SUFFIX.test(hay.slice(end, end + 4))) hits.push(i);
      }
      i = hay.indexOf(tok, i + 1);
    }
    return hits;
  }
  function matchesToken(item, tok, prefix) {
    let score = 0;
    if (wordStarts(item._t, tok, prefix).length) score += 4;
    if (wordStarts(item._s, tok, prefix).length) score += 2;
    if (wordStarts(item._x, tok, prefix).length) score += 1;
    return score;
  }

  function dateWindow() {
    switch (state.range) {
      case 'today': return [LATEST, LATEST];
      case '7d': return [addDays(LATEST, -6), LATEST];
      case '30d': return [addDays(LATEST, -29), LATEST];
      case 'custom': return [state.from || '0000-00-00', state.to || '9999-99-99'];
      default: return null;
    }
  }
  function customLabel() {
    const f = state.from ? fmtShort.format(new Date(`${state.from}T12:00:00Z`)) : 'Start';
    const t = state.to ? fmtShort.format(new Date(`${state.to}T12:00:00Z`)) : 'today';
    return state.from && state.from === state.to ? f : `${f} – ${t}`;
  }
  const RANGE_LABELS = { all: 'Any time', today: 'Latest day', '7d': 'Past 7 days', '30d': 'Past 30 days' };

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (children || []).forEach((c) => c && n.append(c));
    return n;
  }

  // Wrap token hits in <mark>
  function highlighted(text, toks) {
    const frag = document.createDocumentFragment();
    if (!toks.length) { frag.append(text); return frag; }
    const hay = normalize(text);
    const ranges = [];
    toks.forEach((t, n) => wordStarts(hay, t, prefixMode && n === toks.length - 1).forEach((i) => ranges.push([i, i + t.length])));
    if (!ranges.length || hay.length !== text.length) { frag.append(text); return frag; }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    ranges.forEach((r) => {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push(r.slice());
    });
    let pos = 0;
    merged.forEach(([a, b]) => {
      if (a > pos) frag.append(text.slice(pos, a));
      frag.append(el('mark', { text: text.slice(a, b) }));
      pos = b;
    });
    if (pos < text.length) frag.append(text.slice(pos));
    return frag;
  }

  // ---------- data ----------
  let DATA = [];
  let prefixMode = false;
  fetch('search-index.json')
    .then((r) => r.json())
    .then((items) => {
      DATA = items.map((a) => ({
        ...a,
        _t: normalize(a.t), _x: normalize(a.x || ''), _s: normalize(a.s),
        _date: new Date(`${a.p || a.d}:00Z`)
      }));
      update();
    })
    .catch(() => { els.title.textContent = 'Search is unavailable right now.'; });

  // ---------- filtering ----------
  function update() {
    const toks = tokens(state.q);
    const win = dateWindow();
    const sort = state.sort || (toks.length ? 'rel' : 'new');
    const latestTime = new Date(`${LATEST}T23:59:00Z`);

    // Whole words first; if nothing matches, treat the last word as a prefix (still typing)
    function collect(prefixLast) {
      const out = [];
      for (const a of DATA) {
        if (win && (a.d < win[0] || a.d > win[1])) continue;
        let m = 0;
        if (toks.length) {
          let ok = true;
          for (let i = 0; i < toks.length; i++) {
            const s = matchesToken(a, toks[i], prefixLast && i === toks.length - 1);
            if (!s) { ok = false; break; }
            m += s;
          }
          if (!ok) continue;
        }
        out.push({ a, m });
      }
      return out;
    }
    let base = collect(false);
    prefixMode = false;
    if (!base.length && toks.length && toks[toks.length - 1].length >= 2) {
      base = collect(true);
      prefixMode = base.length > 0;
    }
    const inCat = (x) => !state.cats.length || state.cats.includes(x.a.c);
    const inSrc = (x) => !state.srcs.length || state.srcs.includes(x.a.s);
    const results = base.filter((x) => inCat(x) && inSrc(x));

    results.sort(sort === 'rel'
      ? (x, y) => relScore(y) - relScore(x) || y.a._date - x.a._date
      : (x, y) => y.a._date - x.a._date || y.a.r - x.a.r);

    function relScore(x) {
      const age = (latestTime - x.a._date) / 864e5;
      const recency = age < 7 ? 6 : age < 30 ? 3 : age < 90 ? 1 : 0;
      return x.m * 10 + x.a.r + recency;
    }
    // facet counts ignore their own filter
    const catCounts = {}; base.filter(inSrc).forEach((x) => { catCounts[x.a.c] = (catCounts[x.a.c] || 0) + 1; });
    const srcCounts = {}; base.filter(inCat).forEach((x) => { srcCounts[x.a.s] = (srcCounts[x.a.s] || 0) + 1; });

    renderFilters(catCounts, srcCounts);
    renderChips();
    renderSort(sort);
    renderResults(results, toks);
    syncURL();
  }

  function option(type, name, label, count, checked, onChange) {
    return el('label', { class: 'opt' }, [
      el('input', { type, name, checked, onchange: onChange }),
      el('span', { class: 'opt-label', text: label }),
      count !== null ? el('span', { class: 'meta', text: String(count) }) : null
    ]);
  }

  function renderFilters(catCounts, srcCounts) {
    const ranges = ['all', 'today', '7d', '30d'].map((k) =>
      option('radio', 'range', RANGE_LABELS[k], null, state.range === k, () => set({ range: k, from: '', to: '' })));
    if (state.range === 'custom') ranges.push(option('radio', 'range', customLabel(), null, true, () => {}));
    els.range.replaceChildren(...ranges);

    const catKeys = Object.keys(LABELS).filter((k) => catCounts[k] || state.cats.includes(k));
    els.cat.replaceChildren(...(catKeys.length ? catKeys.map((k) =>
      option('checkbox', 'cat', LABELS[k], catCounts[k] || 0, state.cats.includes(k), () => toggle('cats', k)))
      : [el('p', { class: 'meta', text: 'No categories' })]));

    const srcKeys = Object.keys(srcCounts).sort((a, b) => srcCounts[b] - srcCounts[a]).slice(0, 10);
    state.srcs.forEach((s) => { if (!srcKeys.includes(s)) srcKeys.push(s); });
    els.src.replaceChildren(...(srcKeys.length ? srcKeys.map((k) =>
      option('checkbox', 'src', k, srcCounts[k] || 0, state.srcs.includes(k), () => toggle('srcs', k)))
      : [el('p', { class: 'meta', text: 'No sources' })]));
  }

  function chip(label, onClick) {
    return el('button', { type: 'button', class: 'chip chip-remove', 'aria-label': `Remove filter: ${label}`, onclick: onClick }, [
      label,
      (() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '12'); s.setAttribute('height', '12'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'; return s; })()
    ]);
  }

  function renderChips() {
    const chips = [];
    if (state.range !== 'all') chips.push(chip(state.range === 'custom' ? customLabel() : RANGE_LABELS[state.range], () => set({ range: 'all', from: '', to: '' })));
    state.cats.forEach((c) => chips.push(chip(LABELS[c] || c, () => toggle('cats', c))));
    state.srcs.forEach((s) => chips.push(chip(s, () => toggle('srcs', s))));
    if (chips.length) chips.push(el('button', { type: 'button', class: 'link-btn', text: 'Clear all', onclick: () => set({ range: 'all', from: '', to: '', cats: [], srcs: [] }) }));
    els.chips.replaceChildren(...chips);
    els.chips.hidden = !chips.length;
  }

  function renderSort(sort) {
    document.querySelectorAll('[data-sort]').forEach((b) => {
      const on = b.dataset.sort === sort;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderResults(results, toks) {
    const n = results.length;
    const q = state.q.trim();
    els.title.textContent = q
      ? `${n.toLocaleString('en-US')} ${n === 1 ? 'result' : 'results'} for “${q}”`
      : (state.cats.length || state.srcs.length || state.range !== 'all')
        ? `${n.toLocaleString('en-US')} ${n === 1 ? 'article' : 'articles'}`
        : 'Latest articles';
    document.title = q ? `${q} — Search — Big Tech News` : 'Search — Big Tech News';

    els.list.replaceChildren(...results.slice(0, state.limit).map(({ a }) => {
      const dayStr = fmtDay.format(a._date) + (fmtYear.format(a._date) !== thisYear ? `, ${fmtYear.format(a._date)}` : '');
      const isNew = window.BTN && a.p && window.BTN.isNew(a._date);
      const badges = [];
      if (a.w) badges.push(el('span', { class: 'badge badge-paywall', title: 'Subscription required', text: 'Paywall' }));
      if (a.l) badges.push(el('span', { class: 'badge', title: `Not in English (${a.l})`, text: a.l.toUpperCase() }));
      if (a.f) badges.push(el('a', { class: 'free-alt', href: a.f.u, target: '_blank', rel: 'noopener', text: `Free at ${a.f.s}` }));
      return el('li', { class: isNew ? 'result is-new' : 'result' }, [
        el('div', { class: 'result-date' }, [el('strong', { text: dayStr }), el('span', { text: a.p ? fmtTime.format(a._date) : '' })]),
        el('div', { class: 'result-body' }, [
          el('div', { class: 'kicker' }, [
            isNew ? window.BTN.badge() : null, isNew ? ' ' : null,
            el('span', { class: 'kicker-cat', text: LABELS[a.c] || a.c }), ` · ${a.s}`,
            badges.length ? el('span', { class: 'badges' }, [' ', ...badges]) : null
          ]),
          el('h2', { class: 'result-title' }, [el('a', { class: 'hl', href: a.u, target: '_blank', rel: 'noopener' }, [highlighted(a.t, toks)])]),
          a.x ? el('p', { class: 'result-desc' }, [highlighted(a.x, toks)]) : null
        ])
      ]);
    }));
    els.none.hidden = n !== 0;
    const left = n - state.limit;
    els.more.hidden = left <= 0;
    if (left > 0) els.more.textContent = `Show ${Math.min(PAGE, left)} more`;
  }

  // ---------- events ----------
  function set(patch) { Object.assign(state, patch, { limit: PAGE }); update(); }
  function toggle(key, v) {
    const list = state[key].slice();
    const i = list.indexOf(v);
    if (i === -1) list.push(v); else list.splice(i, 1);
    set({ [key]: list });
  }

  let timer;
  if (input) {
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => set({ q: input.value, sort: '' }), 120);
    });
  }
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); set({ q: input.value }); });
  document.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => set({ sort: b.dataset.sort })));
  els.more.addEventListener('click', () => { state.limit += PAGE; update(); });

  // Filters collapse on small screens
  const details = document.querySelector('.filters');
  if (details && window.matchMedia('(max-width: 860px)').matches) details.open = false;
})();
