/**
 * News Sources Configuration
 * Curated sources for high-quality big tech news
 */

const SOURCES = {
  // Major Tech News Sites
  techcrunch: {
    name: 'TechCrunch',
    rss: 'https://techcrunch.com/feed/',
    priority: 1
  },
  theverge: {
    name: 'The Verge',
    rss: 'https://www.theverge.com/rss/index.xml',
    priority: 1
  },
  engadget: {
    name: 'Engadget',
    rss: 'https://www.engadget.com/rss.xml',
    priority: 2
  },
  arstechnica: {
    name: 'Ars Technica',
    rss: 'https://feeds.arstechnica.com/arstechnica/index',
    priority: 1
  },
  wired: {
    name: 'Wired',
    rss: 'https://www.wired.com/feed/rss',
    priority: 2
  },
  
  // Business & Finance Tech
  cnbc_tech: {
    name: 'CNBC',
    rss: 'https://www.cnbc.com/id/19854910/device/rss/rss.html',
    priority: 1
  },
  bloomberg_tech: {
    name: 'Bloomberg',
    rss: 'https://feeds.bloomberg.com/technology/news.rss',
    priority: 1
  },

  // AI Specific
  venturebeat: {
    name: 'VentureBeat',
    rss: 'https://venturebeat.com/feed/',
    priority: 1
  },
  
  // Apple focused
  '9to5mac': {
    name: '9to5Mac',
    rss: 'https://9to5mac.com/feed/',
    priority: 2
  },
  macrumors: {
    name: 'MacRumors',
    rss: 'https://feeds.macrumors.com/MacRumors-All',
    priority: 2
  },
  
  // Google/Android focused
  '9to5google': {
    name: '9to5Google',
    rss: 'https://9to5google.com/feed/',
    priority: 2
  },
  
  // EV & Auto Tech
  electrek: {
    name: 'Electrek',
    rss: 'https://electrek.co/feed/',
    priority: 2
  },
  
  // Hardware & Semiconductors
  tomshardware: {
    name: "Tom's Hardware",
    rss: 'https://www.tomshardware.com/feeds/all',
    priority: 2
  },
  theregister: {
    name: 'The Register',
    rss: 'https://www.theregister.com/headlines.atom',
    priority: 2
  },
  
  // Crypto/Blockchain (reduced priority - only major news)
  coindesk: {
    name: 'CoinDesk',
    rss: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    priority: 3
  },

  // Space
  spacenews: {
    name: 'SpaceNews',
    rss: 'https://spacenews.com/feed/',
    priority: 2
  }
};

// HIGH-IMPACT keywords - stories mentioning these get bonus points
const HIGH_IMPACT_KEYWORDS = [
  // Major AI developments
  'openai', 'anthropic', 'chatgpt', 'gpt-5', 'claude', 'gemini', 'llama',
  'artificial general intelligence', 'agi', 'superintelligence',
  
  // Big company moves
  'acquisition', 'acquires', 'merger', 'billion dollar', 'ipo', 'layoffs',
  'antitrust', 'monopoly', 'regulation', 'ftc', 'doj', 'eu commission',
  
  // Leadership
  'ceo', 'sam altman', 'elon musk', 'mark zuckerberg', 'sundar pichai',
  'satya nadella', 'tim cook', 'jensen huang', 'dario amodei',
  
  // Breakthrough tech
  'breakthrough', 'revolutionary', 'first ever', 'world record',
  'quantum', 'fusion', 'robotaxi', 'humanoid robot'
];

// Companies that matter for big tech digest
const BIG_TECH_COMPANIES = [
  'google', 'alphabet', 'microsoft', 'apple', 'amazon', 'meta', 'facebook',
  'nvidia', 'openai', 'anthropic', 'tesla', 'spacex', 'intel', 'amd',
  'qualcomm', 'broadcom', 'tsmc', 'samsung', 'netflix', 'uber',
  'bytedance', 'tiktok', 'baidu', 'xiaomi', 'huawei',
  'oracle', 'salesforce', 'adobe',
  'coinbase', 'stripe', 'waymo', 'cruise', 'rivian', 'byd',
  'foxconn', 'arm', 'softbank', 'palantir', 'coreweave',
  'perplexity', 'mistral', 'cohere', 'stability ai', 'midjourney',
  'xai', 'neuralink', 'figure ai', 'boston dynamics'
];

// Topics that are RELEVANT (digest-worthy)
const RELEVANT_TOPICS = [
  // AI & ML
  'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
  'large language model', 'llm', 'generative ai', 'foundation model',
  'ai safety', 'alignment', 'ai regulation',
  
  // Chips & Infrastructure
  'semiconductor', 'chip', 'gpu', 'data center', 'supercomputer',
  'blackwell', 'hopper', 'h100', 'b200', 'tpu',
  
  // Autonomous & Robotics
  'autonomous vehicle', 'self-driving', 'robotaxi', 'humanoid robot',
  'automation', 'optimus',
  
  // Space & Frontier
  'starlink', 'starship', 'rocket launch', 'satellite',
  
  // Major Business Moves
  'antitrust', 'regulation', 'lawsuit', 'ipo', 'acquisition',
  'billion', 'valuation', 'funding round', 'layoffs',
  
  // Crypto (only major)
  'bitcoin', 'stablecoin', 'crypto regulation'
];

// Topics to EXCLUDE (not digest-worthy)
const EXCLUDED_PATTERNS = [
  // Product deals & sales
  /deal/i, /\bsale\b/i, /discount/i, /save \$/i, /% off/i, /prime day/i, /black friday/i,
  /best buy/i, /walmart/i, /cheap/i, /budget/i, /price drop/i, /price cut/i,
  
  // Reviews & buying guides
  /\breview:/i, /hands-on/i, /unboxing/i, /\bvs\.?\b/i, /compared/i, /buying guide/i,
  /best phones/i, /best laptops/i, /best tv/i, /best headphones/i, /best wireless/i,
  /top \d+ /i, /\d+ best /i,
  
  // How-to & tips
  /how to/i, /tips for/i, /guide to/i, /tutorial/i, /step by step/i,
  /ways to/i, /things you/i, /everything you need/i,
  
  // Minor updates
  /now available/i, /rolling out/i, /coming soon/i, /early access/i,
  /gets a new/i, /adds support/i,
  
  // Entertainment/lifestyle
  /game review/i, /movie review/i, /tv show/i, /playlist/i,
  /recipe/i, /fitness/i, /wellness/i,
  
  // Clickbait patterns
  /you need to/i, /you should/i, /why you/i, /don't miss/i, /must have/i,
  /\bsecret\b/i, /\bhack\b/i, /\btrick\b/i, /won't believe/i, /this is why/i
];

// Categories for organizing news
const CATEGORIES = {
  ai: {
    name: 'AI',
    icon: '🤖',
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'chatgpt', 
               'claude', 'gemini', 'openai', 'anthropic', 'gpt', 'neural', 'deep learning',
               'generative ai', 'copilot', 'perplexity', 'midjourney', 'stable diffusion',
               'foundation model', 'training', 'inference']
  },
  chips_cloud: {
    name: 'Chips & Cloud',
    icon: '💾',
    keywords: ['nvidia', 'amd', 'intel', 'qualcomm', 'tsmc', 'samsung chip', 'semiconductor',
               'processor', 'gpu', 'cpu', 'aws', 'azure', 'gcp', 'cloud', 'data center',
               'blackwell', 'hopper', 'coreweave', 'broadcom', 'arm']
  },
  robotics: {
    name: 'Robotics',
    icon: '🦾',
    keywords: ['robot', 'robotics', 'optimus', 'humanoid', 'automation', 'boston dynamics',
               'figure', 'agility', 'warehouse robot']
  },
  ev_autonomous: {
    name: 'EV & Autonomous',
    icon: '🚗',
    keywords: ['tesla', 'ev', 'electric vehicle', 'waymo', 'cruise', 'autonomous', 'self-driving',
               'robotaxi', 'rivian', 'lucid', 'byd', 'nio', 'xpeng', 'battery', 'charging']
  },
  space: {
    name: 'Space',
    icon: '🚀',
    keywords: ['spacex', 'starlink', 'starship', 'nasa', 'rocket', 'satellite', 'orbit',
               'blue origin', 'kuiper', 'launch']
  },
  regulation: {
    name: 'Regulation',
    icon: '⚖️',
    keywords: ['antitrust', 'regulation', 'ftc', 'doj', 'eu', 'gdpr', 'privacy', 'lawsuit',
               'fine', 'compliance', 'congress', 'senate', 'bill', 'monopoly']
  },
  business: {
    name: 'Business',
    icon: '📈',
    keywords: ['acquisition', 'merger', 'ipo', 'funding', 'valuation', 'layoff',
               'earnings', 'revenue', 'billion', 'ceo', 'executive']
  },
  crypto: {
    name: 'Crypto',
    icon: '₿',
    keywords: ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'stablecoin',
               'coinbase', 'binance', 'sec crypto', 'crypto regulation']
  }
};

module.exports = { 
  SOURCES, 
  HIGH_IMPACT_KEYWORDS, 
  BIG_TECH_COMPANIES, 
  RELEVANT_TOPICS, 
  EXCLUDED_PATTERNS, 
  CATEGORIES 
};
