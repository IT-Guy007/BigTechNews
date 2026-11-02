#!/usr/bin/env node
/**
 * Opens a GitHub issue for every feed that has failed FAILURE_THRESHOLD runs in a
 * row (12 runs = 24 hours at one run per 2 hours), and closes it again with a
 * comment once the feed recovers. Reads data/feed-health.json written by the scraper.
 *
 * Env: GITHUB_TOKEN, GITHUB_REPOSITORY ("owner/repo"). Without a token it only
 * prints what it would do (dry run).
 */

const fs = require('fs');
const path = require('path');

const FAILURE_THRESHOLD = Number(process.env.FEED_FAILURE_THRESHOLD || 12);
const LABEL = 'feed-health';
const HEALTH_FILE = path.join(__dirname, '..', 'data', 'feed-health.json');
const { SOURCES } = require('../scraper/sources');

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const dryRun = !token || !repo;

const titleFor = (key, feed) => `Feed failing: ${feed.name} (${key})`;

async function gh(method, url, body) {
  const res = await fetch(`https://api.github.com/repos/${repo}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok && !(method === 'POST' && url === '/labels' && res.status === 422)) {
    throw new Error(`${method} ${url}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

function plan(health, openIssues) {
  const actions = [];
  const openByTitle = new Map(openIssues.map(i => [i.title, i]));
  for (const [key, feed] of Object.entries(health.feeds || {})) {
    const title = titleFor(key, feed);
    const open = openByTitle.get(title);
    if (!feed.ok && feed.consecutiveFailures >= FAILURE_THRESHOLD && !open) {
      actions.push({ type: 'open', key, feed, title });
    } else if (feed.ok && open) {
      actions.push({ type: 'close', key, feed, issue: open });
    }
  }
  return actions;
}

function issueBody(key, feed, checkedAt) {
  return [
    `The **${feed.name}** feed has failed **${feed.consecutiveFailures} scraper runs in a row**.`,
    '',
    '| | |',
    '|---|---|',
    `| Feed key | \`${key}\` |`,
    `| URL | ${SOURCES[key]?.rss || 'unknown'} |`,
    `| Last error | \`${(feed.error || 'unknown').replace(/\|/g, '/').replace(/\n/g, ' ')}\` |`,
    `| Last success | ${feed.lastSuccess || 'never recorded'} |`,
    `| Checked at | ${checkedAt} |`,
    '',
    'Fix or remove the feed in `scraper/sources.js`. This issue closes automatically when the feed works again.'
  ].join('\n');
}

async function main() {
  if (!fs.existsSync(HEALTH_FILE)) {
    console.log('No feed-health.json yet; nothing to do.');
    return;
  }
  const health = JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf-8'));
  const openIssues = dryRun ? [] : (await gh('GET', `/issues?labels=${LABEL}&state=open&per_page=100`)).filter(i => !i.pull_request);
  const actions = plan(health, openIssues);

  if (!actions.length) {
    console.log('Feed health: no issues to open or close.');
    return;
  }
  if (dryRun) {
    for (const a of actions) console.log(`[dry run] would ${a.type} issue for ${a.feed.name} (${a.key})`);
    return;
  }

  await gh('POST', '/labels', { name: LABEL, color: 'B60205', description: 'A news feed is failing' });
  for (const a of actions) {
    if (a.type === 'open') {
      const issue = await gh('POST', '/issues', { title: a.title, body: issueBody(a.key, a.feed, health.checkedAt), labels: [LABEL] });
      console.log(`Opened #${issue.number}: ${a.title}`);
    } else {
      await gh('POST', `/issues/${a.issue.number}/comments`, { body: `The feed is working again (${a.feed.items} items at ${health.checkedAt}). Closing.` });
      await gh('PATCH', `/issues/${a.issue.number}`, { state: 'closed', state_reason: 'completed' });
      console.log(`Closed #${a.issue.number}: ${a.issue.title}`);
    }
  }
}

if (require.main === module) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { plan, titleFor, FAILURE_THRESHOLD };
