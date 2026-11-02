/**
 * News Sources Configuration
 *
 * Every keyword below is matched as a WHOLE WORD (case-insensitive, plural "s"/"es"
 * and possessive "'s" allowed). So "ai" matches "AI" and "AI's" but not "said";
 * "ev" matches "EVs" but not "every"; "intel" never matches "intelligence".
 *
 * Source fields:
 *   name      Display name
 *   rss       Feed URL
 *   priority  1 = high-signal outlet (+1 score), 2 = normal, 3 = low
 *   group     Only used for docs / feed-health reporting
 *   general   Broad feed (markets, front pages): items only count when they name a
 *             tracked company or a high-impact keyword
 *   company   (official newsrooms) company keyword credited to every item, since
 *             a company rarely names itself in its own post titles
 *   paywall   true when most articles need a subscription (shown as a badge)
 *   lang      ISO code when the feed is not in English (shown as a badge)
 */

const SOURCES = {
  // ---------- Major tech news ----------
  techcrunch:   { name: 'TechCrunch',   rss: 'https://techcrunch.com/feed/', priority: 1, group: 'tech' },
  theverge:     { name: 'The Verge',    rss: 'https://www.theverge.com/rss/index.xml', priority: 1, group: 'tech' },
  engadget:     { name: 'Engadget',     rss: 'https://www.engadget.com/rss.xml', priority: 2, group: 'tech' },
  arstechnica:  { name: 'Ars Technica', rss: 'https://feeds.arstechnica.com/arstechnica/index', priority: 1, group: 'tech' },
  wired:        { name: 'Wired',        rss: 'https://www.wired.com/feed/rss', priority: 2, group: 'tech' },
  gizmodo:      { name: 'Gizmodo',      rss: 'https://gizmodo.com/rss', priority: 2, group: 'tech' },
  '404media':   { name: '404 Media',    rss: 'https://www.404media.co/rss/', priority: 2, group: 'tech' },
  euronews_next:{ name: 'Euronews Next', rss: 'https://www.euronews.com/rss?level=vertical&name=next', priority: 2, group: 'tech', general: true },

  // ---------- Business & finance ----------
  cnbc_tech:    { name: 'CNBC',         rss: 'https://www.cnbc.com/id/19854910/device/rss/rss.html', priority: 1, group: 'business' },
  cnbc_top:     { name: 'CNBC',         rss: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', priority: 1, group: 'business', general: true },
  bloomberg_tech:    { name: 'Bloomberg', rss: 'https://feeds.bloomberg.com/technology/news.rss', priority: 1, group: 'business', paywall: true },
  bloomberg_markets: { name: 'Bloomberg', rss: 'https://feeds.bloomberg.com/markets/news.rss', priority: 1, group: 'business', general: true, paywall: true },
  wsj_tech:     { name: 'WSJ',          rss: 'https://feeds.content.dowjones.io/public/rss/RSSWSJD', priority: 1, group: 'business', paywall: true },
  theinformation: { name: 'The Information', rss: 'https://www.theinformation.com/feed', priority: 1, group: 'business', paywall: true },
  siliconangle: { name: 'SiliconANGLE', rss: 'https://siliconangle.com/feed/', priority: 2, group: 'business' },

  // ---------- Aggregators ----------
  techmeme:     { name: 'Techmeme',     rss: 'https://www.techmeme.com/feed.xml', priority: 1, group: 'aggregator' },
  hackernews:   { name: 'Hacker News',  rss: 'https://hnrss.org/frontpage?points=200', priority: 2, group: 'aggregator', general: true },

  // ---------- AI ----------
  techreview:   { name: 'MIT Technology Review', rss: 'https://www.technologyreview.com/feed/', priority: 1, group: 'ai' },
  thedecoder:   { name: 'The Decoder',  rss: 'https://the-decoder.com/feed/', priority: 2, group: 'ai' },

  // ---------- Apple / Google / mobile ----------
  '9to5mac':    { name: '9to5Mac',      rss: 'https://9to5mac.com/feed/', priority: 2, group: 'mobile' },
  macrumors:    { name: 'MacRumors',    rss: 'https://feeds.macrumors.com/MacRumors-All', priority: 2, group: 'mobile' },
  appleinsider: { name: 'AppleInsider', rss: 'https://appleinsider.com/rss/news/', priority: 2, group: 'mobile' },
  '9to5google': { name: '9to5Google',   rss: 'https://9to5google.com/feed/', priority: 2, group: 'mobile' },
  androidauthority: { name: 'Android Authority', rss: 'https://www.androidauthority.com/feed/', priority: 2, group: 'mobile' },
  gsmarena:     { name: 'GSMArena',     rss: 'https://www.gsmarena.com/rss-news-reviews.php3', priority: 3, group: 'mobile' },

  // ---------- Chips, cloud & data centers ----------
  tomshardware: { name: "Tom's Hardware", rss: 'https://www.tomshardware.com/feeds/all', priority: 2, group: 'chips' },
  theregister:  { name: 'The Register', rss: 'https://api.theregister.com/api/v1/article?orderBy=published&site_id=2&remapper=rss&content=node', priority: 2, group: 'chips' },
  dcd:          { name: 'DataCenterDynamics', rss: 'https://www.datacenterdynamics.com/en/rss/', priority: 2, group: 'chips' },
  eetimes:      { name: 'EE Times',     rss: 'https://www.eetimes.com/feed/', priority: 2, group: 'chips' },
  servethehome: { name: 'ServeTheHome', rss: 'https://www.servethehome.com/feed/', priority: 3, group: 'chips' },

  // ---------- EV, autonomy & robotics ----------
  electrek:     { name: 'Electrek',     rss: 'https://electrek.co/feed/', priority: 2, group: 'ev' },
  insideevs:    { name: 'InsideEVs',    rss: 'https://insideevs.com/rss/news/all/', priority: 2, group: 'ev' },
  teslarati:    { name: 'Teslarati',    rss: 'https://www.teslarati.com/feed/', priority: 3, group: 'ev' },

  // ---------- Space ----------
  spacenews:    { name: 'SpaceNews',    rss: 'https://spacenews.com/feed/', priority: 2, group: 'space' },
  spacecom:     { name: 'Space.com',    rss: 'https://www.space.com/feeds/all', priority: 2, group: 'space' },

  // ---------- Asia & Europe ----------
  nikkei_asia:  { name: 'Nikkei Asia',  rss: 'https://asia.nikkei.com/rss/feed/nar', priority: 1, group: 'asia', paywall: true },
  scmp_tech:    { name: 'SCMP',         rss: 'https://www.scmp.com/rss/36/feed', priority: 2, group: 'asia' },
  trendforce:   { name: 'TrendForce',   rss: 'https://www.trendforce.com/news/feed/', priority: 2, group: 'asia' },
  heise:        { name: 'heise online', rss: 'https://www.heise.de/rss/heise-atom.xml', priority: 2, group: 'europe', lang: 'de' },
  tweakers:     { name: 'Tweakers',     rss: 'https://tweakers.net/feeds/mixed.xml', priority: 2, group: 'europe', lang: 'nl' },
  // Not added: DigiTimes (blocks automated requests with HTTP 403/406)

  // ---------- Crypto (only major news passes the score threshold) ----------
  coindesk:     { name: 'CoinDesk',     rss: 'https://www.coindesk.com/arc/outboundfeeds/rss/', priority: 3, group: 'crypto' },
  theblock:     { name: 'The Block',    rss: 'https://www.theblock.co/rss.xml', priority: 3, group: 'crypto' },
  decrypt:      { name: 'Decrypt',      rss: 'https://decrypt.co/feed', priority: 3, group: 'crypto' },

  // ---------- Official newsrooms (primary sources, low volume) ----------
  openai_news:  { name: 'OpenAI',       rss: 'https://openai.com/news/rss.xml', priority: 1, group: 'official', company: 'openai' },
  google_blog:  { name: 'Google',       rss: 'https://blog.google/rss/', priority: 1, group: 'official', company: 'google' },
  nvidia_news:  { name: 'NVIDIA',       rss: 'https://nvidianews.nvidia.com/releases.xml', priority: 1, group: 'official', company: 'nvidia' },
  apple_news:   { name: 'Apple Newsroom', rss: 'https://www.apple.com/newsroom/rss-feed.rss', priority: 1, group: 'official', company: 'apple' },
  microsoft_blog: { name: 'Microsoft',  rss: 'https://blogs.microsoft.com/feed/', priority: 1, group: 'official', company: 'microsoft' },
  meta_news:    { name: 'Meta Newsroom', rss: 'https://about.fb.com/feed/', priority: 1, group: 'official', company: 'meta' }

  // Removed: VentureBeat (feed returns HTTP 429; 0 articles in the last 30 days)
};

// HIGH-IMPACT keywords: +3 each
const HIGH_IMPACT_KEYWORDS = [
  // Major AI developments
  'openai', 'anthropic', 'chatgpt', 'claude', 'gemini', 'llama', 'deepseek',
  'artificial general intelligence', 'agi', 'superintelligence',

  // Big company moves
  'acquisition', 'acquires', 'acquire', 'merger', 'ipo', 'layoffs', 'layoff',
  'antitrust', 'monopoly', 'ftc', 'doj', 'european commission', 'eu commission',

  // Leadership
  'sam altman', 'elon musk', 'mark zuckerberg', 'sundar pichai', 'satya nadella',
  'tim cook', 'jensen huang', 'dario amodei', 'demis hassabis', 'lisa su', 'andy jassy',

  // Breakthrough tech
  'breakthrough', 'first ever', 'world record',
  'quantum computer', 'quantum computing', 'fusion', 'robotaxi', 'humanoid robot'
];

// Companies that matter for a big tech digest: +2 each (+2 more when in the title)
const BIG_TECH_COMPANIES = [
  'google', 'alphabet', 'microsoft', 'apple', 'amazon', 'aws', 'meta', 'facebook', 'instagram', 'whatsapp',
  'nvidia', 'openai', 'anthropic', 'tesla', 'spacex', 'intel', 'amd', 'qualcomm', 'broadcom',
  'tsmc', 'samsung', 'sk hynix', 'micron', 'asml', 'arm holdings', 'netflix', 'uber', 'ibm', 'oracle',
  'salesforce', 'adobe', 'cisco', 'dell', 'palantir', 'coreweave', 'snowflake', 'databricks',
  'bytedance', 'tiktok', 'baidu', 'alibaba', 'tencent', 'xiaomi', 'huawei', 'deepseek',
  'coinbase', 'stripe', 'waymo', 'zoox', 'rivian', 'lucid', 'byd', 'foxconn', 'softbank',
  'perplexity', 'mistral', 'cohere', 'scale ai', 'stability ai', 'midjourney', 'xai',
  'neuralink', 'figure ai', 'boston dynamics', 'blue origin', 'rocket lab'
];

// Topics that make a story digest-worthy: +1 each
const RELEVANT_TOPICS = [
  // AI & ML
  'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
  'large language model', 'llm', 'generative ai', 'foundation model', 'ai model', 'ai agent',
  'ai safety', 'alignment', 'ai regulation',

  // Chips & infrastructure
  'semiconductor', 'chip', 'chipmaker', 'gpu', 'data center', 'supercomputer',
  'blackwell', 'rubin', 'h100', 'b200', 'tpu', 'hbm',

  // Autonomous & robotics
  'autonomous vehicle', 'self-driving', 'robotaxi', 'humanoid', 'automation', 'optimus',

  // Space & frontier
  'starlink', 'starship', 'rocket launch', 'satellite',

  // Business
  'ceo', 'antitrust', 'regulation', 'lawsuit', 'acquisition', 'earnings',
  'valuation', 'funding round', 'layoffs', 'billion',

  // Crypto (major only)
  'bitcoin', 'stablecoin', 'crypto regulation'
];

// HARD exclusions: shopping, reviews, how-tos, puzzles. These never make the digest.
const EXCLUDED_PATTERNS = [
  // Shopping & deals (but NOT business deals: "OpenAI inks deals with UAE" stays)
  /^deals?\b/i,
  /\b(?:weekend|black friday|cyber monday|prime day|holiday|early|best|today'?s|limited[- ]time|top|daily|hot)\b[^.:]{0,30}\bdeals?\b/i,
  /\bdeals? (?:on|of the day|roundup)\b/i,
  /\$\d[\d,.]*\s?off\b/i, /\b\d+% off\b/i, /\ball-time low\b/i, /\blowest price\b/i, /\bprice (?:drop|cut)\b/i,
  /\bdiscounts?\b/i, /\bon sale\b/i, /\bcoupons?\b/i, /\bpromo codes?\b/i, /\bis a steal\b/i,

  // Reviews & buying guides
  /\breview:/i, /\breview$/i, /\bhands-on\b/i, /\bunboxing\b/i, /\bbuying guide\b/i,
  /^(?:the )?\d+ best\b/i, /^best\b/i, /\bbest (?:phones|laptops|tvs?|headphones|earbuds|chromebooks|tablets|smartwatches)\b/i,

  // How-to
  /\bhow to\b/i, /\btips (?:for|to)\b/i, /\bstep[- ]by[- ]step\b/i, /\btutorial\b/i,

  // Puzzles, entertainment, lifestyle
  /\bwordle\b/i, /\bconnections (?:hints?|answers?)\b/i, /\bstrands\b/i, /\bhoroscope/i,
  /\b(?:game|movie|tv) review\b/i, /\brecipes?\b/i
];

// SOFT penalties (-4): minor updates and clickbait. A strong story still gets through.
const PENALIZED_PATTERNS = [
  /\brolling out\b/i, /\bnow available\b/i, /\bcoming soon\b/i, /\bearly access\b/i,
  /\bgets a new\b/i, /\badds support\b/i, /\bpre-?orders?\b/i,
  /\byou need to\b/i, /\byou should\b/i, /\bwhy you\b/i, /\bdon'?t miss\b/i, /\bmust[- ]have\b/i,
  /\bwon'?t believe\b/i, /\bthis is why\b/i, /\bthings you\b/i, /\bways to\b/i, /\beverything you need\b/i,
  /\bpodcast\b/i, /\bnewsletter\b/i, /\bweekly roundup\b/i,
  // product comparisons ("Ceramic vs Titanium Apple Watch: which is better?"), not court cases ("Apple vs. Epic")
  /\bvs\.?\s.*(?:\bwhich\b|\?)/i
];

// Categories. Title matches count double; the highest total wins (ties go to the
// first category in this list, so the specific ones come before the broad AI bucket).
const CATEGORIES = {
  robotics: {
    name: 'Robotics',
    icon: '🦾',
    keywords: ['robot', 'robotics', 'optimus', 'humanoid', 'boston dynamics', 'figure ai',
               'agility robotics', 'unitree', 'warehouse robot']
  },
  ev_autonomous: {
    name: 'EVs & Autonomy',
    icon: '🚗',
    keywords: ['tesla', 'ev', 'electric vehicle', 'electric car', 'waymo', 'zoox', 'autonomous driving',
               'autonomous vehicle', 'self-driving', 'robotaxi', 'cybercab', 'fsd', 'rivian', 'lucid',
               'byd', 'nio', 'xpeng', 'polestar', 'ev charging']
  },
  space: {
    name: 'Space',
    icon: '🚀',
    keywords: ['spacex', 'starlink', 'starship', 'nasa', 'rocket', 'satellite', 'orbit', 'orbital',
               'blue origin', 'kuiper', 'rocket lab', 'launch vehicle', 'falcon 9', 'moon', 'mars']
  },
  crypto: {
    name: 'Crypto',
    icon: '₿',
    keywords: ['bitcoin', 'ethereum', 'crypto', 'cryptocurrency', 'blockchain', 'stablecoin',
               'coinbase', 'binance', 'btc', 'eth', 'solana', 'crypto regulation']
  },
  regulation: {
    name: 'Regulation',
    icon: '⚖️',
    keywords: ['antitrust', 'regulation', 'regulator', 'ftc', 'doj', 'eu', 'european commission', 'gdpr',
               'digital markets act', 'dma', 'privacy', 'lawsuit', 'sued', 'sues', 'court', 'judge',
               'fined', 'compliance', 'congress', 'senate', 'monopoly', 'export controls', 'tariff']
  },
  chips_cloud: {
    name: 'Chips & Cloud',
    icon: '💾',
    keywords: ['nvidia', 'amd', 'intel', 'qualcomm', 'tsmc', 'asml', 'sk hynix', 'micron', 'semiconductor',
               'chip', 'chipmaker', 'processor', 'gpu', 'cpu', 'hbm', 'memory chip', 'aws', 'azure',
               'google cloud', 'cloud', 'data center', 'blackwell', 'rubin', 'coreweave', 'broadcom', 'arm holdings', 'foundry']
  },
  business: {
    name: 'Business',
    icon: '📈',
    keywords: ['acquisition', 'acquires', 'merger', 'ipo', 'funding', 'funding round', 'valuation', 'layoff',
               'layoffs', 'earnings', 'revenue', 'quarterly', 'shares', 'stock', 'investors', 'ceo', 'executive']
  },
  devices: {
    name: 'Devices',
    icon: '📱',
    keywords: ['iphone', 'ipad', 'mac', 'macbook', 'apple watch', 'airpods', 'vision pro', 'pixel',
               'galaxy', 'android', 'ios', 'smartphone', 'phone', 'laptop', 'tablet', 'wearable',
               'smartwatch', 'headset', 'chromebook', 'googlebook', 'alexa', 'smart home', 'smart speaker', 'apple tv', 'fire tv', 'console', 'playstation', 'xbox', 'nintendo']
  },
  ai: {
    name: 'AI',
    icon: '🤖',
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'chatgpt', 'claude', 'gemini',
               'openai', 'anthropic', 'gpt', 'deepseek', 'mistral', 'llama', 'grok', 'xai', 'copilot',
               'perplexity', 'midjourney', 'generative ai', 'foundation model', 'ai model', 'ai agent',
               'agentic', 'chatbot', 'neural network', 'deep learning']
  }
};

module.exports = {
  SOURCES,
  HIGH_IMPACT_KEYWORDS,
  BIG_TECH_COMPANIES,
  RELEVANT_TOPICS,
  EXCLUDED_PATTERNS,
  PENALIZED_PATTERNS,
  CATEGORIES
};
