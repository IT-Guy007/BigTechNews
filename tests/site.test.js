/**
 * Regression tests for the site generator's badges, trending and feed-issue planning.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { sourceFlags, freeAlternative, badges, computeTrending, catKey } = require('../build/generate.js');
const { plan, titleFor } = require('../scripts/feed-issues.js');

test('paywalled sources get a badge, free ones do not', () => {
  assert.equal(sourceFlags({ sourceKey: 'bloomberg_tech' }).paywall, true);
  assert.equal(sourceFlags({ source: 'WSJ' }).paywall, true, 'lookup by name works for alsoIn entries');
  assert.equal(sourceFlags({ sourceKey: 'techcrunch' }).paywall, false);
  assert.match(badges({ sourceKey: 'bloomberg_tech', source: 'Bloomberg' }), /Paywall/);
  assert.doesNotMatch(badges({ sourceKey: 'techcrunch', source: 'TechCrunch' }), /Paywall/);
});

test('non-English sources get a language badge', () => {
  assert.match(badges({ sourceKey: 'heise', source: 'heise online' }), />DE</);
  assert.match(badges({ sourceKey: 'tweakers', source: 'Tweakers' }), />NL</);
});

test('a paywalled story links to a free outlet covering it', () => {
  const a = {
    sourceKey: 'bloomberg_tech', source: 'Bloomberg',
    alsoIn: [{ source: 'WSJ', link: 'https://wsj.com/x' }, { source: 'TechCrunch', link: 'https://techcrunch.com/x' }]
  };
  assert.equal(freeAlternative(a).source, 'TechCrunch');
  assert.match(badges(a), /Free at TechCrunch/);
  assert.equal(freeAlternative({ sourceKey: 'techcrunch', alsoIn: [{ source: 'Wired', link: 'https://w.com' }] }), null);
});

test('trending only counts names that appear in headlines', () => {
  const arts = [
    { title: 'Intel cuts jobs', matchedKeywords: ['intel'] },
    { title: "Intel's new CEO", matchedKeywords: ['intel'] },
    { title: 'Artificial intelligence hype', matchedKeywords: ['intel'] },
    { title: 'OpenAI raises money', matchedKeywords: ['openai', 'billion'] },
    { title: 'OpenAI ships model worth a billion', matchedKeywords: ['openai', 'billion'] }
  ];
  const t = computeTrending(arts);
  assert.deepEqual(t.map(x => [x.label, x.n]), [['Intel', 2], ['OpenAI', 2]]);
});

test('unknown categories fall back to "other"', () => {
  assert.equal(catKey({ category: null }), 'other');
  assert.equal(catKey({ category: 'devices' }), 'devices');
});

test('feed issues open after the threshold and close on recovery', () => {
  const health = {
    feeds: {
      dead: { name: 'Dead', ok: false, consecutiveFailures: 12, error: 'HTTP 404' },
      flaky: { name: 'Flaky', ok: false, consecutiveFailures: 3 },
      back: { name: 'Back', ok: true, items: 20, consecutiveFailures: 0 }
    }
  };
  const open = [{ number: 7, title: titleFor('back', health.feeds.back) }, { number: 8, title: titleFor('dead', health.feeds.dead) }];
  assert.deepEqual(plan(health, []).map(a => `${a.type}:${a.key}`), ['open:dead']);
  assert.deepEqual(plan(health, open).map(a => `${a.type}:${a.key}`), ['close:back'], 'no duplicate issue for "dead"');
});
