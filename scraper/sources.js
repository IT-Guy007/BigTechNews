/**
 * News Sources Configuration
 * These are the same sources used by Big Tech Digest
 */

const SOURCES = {
  // Major Tech News Sites
  techcrunch: {
    name: 'TechCrunch',
    rss: 'https://techcrunch.com/feed/',
    categories: ['ai', 'startups', 'apps', 'venture']
  },
  theverge: {
    name: 'The Verge',
    rss: 'https://www.theverge.com/rss/index.xml',
    categories: ['tech', 'science', 'entertainment']
  },
  engadget: {
    name: 'Engadget',
    rss: 'https://www.engadget.com/rss.xml',
    categories: ['tech', 'gadgets', 'gaming']
  },
  arstechnica: {
    name: 'Ars Technica',
    rss: 'https://feeds.arstechnica.com/arstechnica/index',
    categories: ['tech', 'science', 'policy']
  },
  wired: {
    name: 'Wired',
    rss: 'https://www.wired.com/feed/rss',
    categories: ['tech', 'science', 'culture']
  },
  
  // Business & Finance Tech
  cnbc_tech: {
    name: 'CNBC Tech',
    rss: 'https://www.cnbc.com/id/19854910/device/rss/rss.html',
    categories: ['business', 'markets', 'tech']
  },
  reuters_tech: {
    name: 'Reuters Tech',
    rss: 'https://www.reutersagency.com/feed/?best-topics=tech&post_type=best',
    categories: ['business', 'tech']
  },
  bloomberg_tech: {
    name: 'Bloomberg Technology',
    rss: 'https://feeds.bloomberg.com/technology/news.rss',
    categories: ['business', 'tech']
  },

  // AI Specific
  venturebeat: {
    name: 'VentureBeat',
    rss: 'https://venturebeat.com/feed/',
    categories: ['ai', 'enterprise', 'startups']
  },
  
  // Apple focused
  '9to5mac': {
    name: '9to5Mac',
    rss: 'https://9to5mac.com/feed/',
    categories: ['apple', 'ios', 'mac']
  },
  macrumors: {
    name: 'MacRumors',
    rss: 'https://feeds.macrumors.com/MacRumors-All',
    categories: ['apple', 'ios', 'mac']
  },
  
  // Google/Android focused
  '9to5google': {
    name: '9to5Google',
    rss: 'https://9to5google.com/feed/',
    categories: ['google', 'android', 'chrome']
  },
  
  // EV & Auto Tech
  electrek: {
    name: 'Electrek',
    rss: 'https://electrek.co/feed/',
    categories: ['ev', 'tesla', 'energy']
  },
  
  // Hardware
  tomshardware: {
    name: "Tom's Hardware",
    rss: 'https://www.tomshardware.com/feeds/all',
    categories: ['hardware', 'chips', 'components']
  },
  
  // Crypto/Blockchain
  coindesk: {
    name: 'CoinDesk',
    rss: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    categories: ['crypto', 'blockchain', 'web3']
  },
  cointelegraph: {
    name: 'Cointelegraph',
    rss: 'https://cointelegraph.com/rss',
    categories: ['crypto', 'blockchain', 'defi']
  },

  // Semiconductor & Cloud
  theregister: {
    name: 'The Register',
    rss: 'https://www.theregister.com/headlines.atom',
    categories: ['enterprise', 'cloud', 'hardware']
  },
  
  // Gaming
  polygon: {
    name: 'Polygon',
    rss: 'https://www.polygon.com/rss/index.xml',
    categories: ['gaming', 'entertainment']
  },

  // Robotics
  therobotreport: {
    name: 'The Robot Report',
    rss: 'https://www.therobotreport.com/feed/',
    categories: ['robotics', 'automation']
  },

  // Search & SEO
  searchengineland: {
    name: 'Search Engine Land',
    rss: 'https://searchengineland.com/feed',
    categories: ['search', 'google', 'seo']
  },

  // Space
  spacenews: {
    name: 'SpaceNews',
    rss: 'https://spacenews.com/feed/',
    categories: ['space', 'satellites']
  }
};

// Big Tech company keywords for filtering
const BIG_TECH_KEYWORDS = [
  // Companies
  'google', 'alphabet', 'microsoft', 'apple', 'amazon', 'meta', 'facebook',
  'nvidia', 'openai', 'anthropic', 'tesla', 'spacex', 'intel', 'amd',
  'qualcomm', 'broadcom', 'tsmc', 'samsung', 'netflix', 'spotify', 'uber',
  'alibaba', 'tencent', 'bytedance', 'tiktok', 'baidu', 'xiaomi', 'huawei',
  'oracle', 'salesforce', 'adobe', 'zoom', 'slack', 'twitter', 'x corp',
  'snap', 'snapchat', 'pinterest', 'linkedin', 'github', 'gitlab',
  'coinbase', 'binance', 'stripe', 'paypal', 'square', 'block inc',
  'shopify', 'ebay', 'waymo', 'cruise', 'rivian', 'lucid', 'byd',
  'foxconn', 'arm holdings', 'softbank', 'berkshire', 'palantir',
  'snowflake', 'databricks', 'cloudflare', 'crowdstrike', 'palo alto',
  'coreweave', 'scale ai', 'perplexity', 'mistral', 'cohere', 'stability ai',
  'midjourney', 'runway', 'figma', 'canva', 'notion', 'discord', 'reddit',
  'xai', 'neuralink', 'boring company', 'world', 'worldcoin',
  
  // Products & Technologies
  'chatgpt', 'gpt-4', 'gpt-5', 'claude', 'gemini', 'llama', 'copilot',
  'siri', 'alexa', 'bard', 'dall-e', 'midjourney', 'stable diffusion',
  'iphone', 'ipad', 'macbook', 'airpods', 'apple watch', 'vision pro',
  'android', 'pixel', 'chromebook', 'windows', 'azure', 'aws', 'gcp',
  'kubernetes', 'docker', 'tensorflow', 'pytorch', 'transformer',
  'model 3', 'model y', 'cybertruck', 'robotaxi', 'optimus',
  'starlink', 'starship', 'falcon', 'dragon',
  'quest', 'oculus', 'hololens', 'playstation', 'xbox', 'switch',
  'bitcoin', 'ethereum', 'stablecoin', 'nft', 'defi', 'web3',
  'blackwell', 'hopper', 'a100', 'h100', 'b200',
  
  // Concepts
  'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
  'large language model', 'llm', 'generative ai', 'gen ai',
  'autonomous vehicle', 'self-driving', 'robotaxi', 'ev', 'electric vehicle',
  'quantum computing', 'semiconductor', 'chip', 'processor', 'gpu', 'cpu',
  'cloud computing', 'data center', 'hyperscaler',
  'social media', 'streaming', 'e-commerce', 'fintech', 'regtech',
  'antitrust', 'monopoly', 'regulation', 'privacy', 'data protection',
  'metaverse', 'virtual reality', 'augmented reality', 'mixed reality',
  'ipo', 'acquisition', 'merger', 'layoff', 'earnings',
  'series a', 'series b', 'series c', 'unicorn', 'valuation'
];

// Categories for organizing news (similar to Big Tech Digest)
const CATEGORIES = {
  ai: {
    name: 'AI',
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'chatgpt', 
               'claude', 'gemini', 'openai', 'anthropic', 'gpt', 'neural', 'deep learning',
               'generative ai', 'copilot', 'perplexity', 'midjourney', 'stable diffusion']
  },
  chips_cloud: {
    name: 'Chips / Cloud',
    keywords: ['nvidia', 'amd', 'intel', 'qualcomm', 'tsmc', 'samsung', 'chip', 'semiconductor',
               'processor', 'gpu', 'cpu', 'aws', 'azure', 'gcp', 'cloud', 'data center',
               'blackwell', 'hopper', 'coreweave', 'broadcom', 'arm']
  },
  robotics: {
    name: 'Robotics',
    keywords: ['robot', 'robotics', 'optimus', 'humanoid', 'automation', 'boston dynamics',
               'figure', 'agility']
  },
  commerce: {
    name: 'Commerce',
    keywords: ['amazon', 'shopify', 'ebay', 'e-commerce', 'retail', 'warehouse', 'delivery',
               'prime', 'alibaba', 'temu', 'shein']
  },
  social_media: {
    name: 'Social Media',
    keywords: ['meta', 'facebook', 'instagram', 'twitter', 'x corp', 'tiktok', 'bytedance',
               'snap', 'snapchat', 'linkedin', 'reddit', 'threads', 'bluesky', 'mastodon']
  },
  content: {
    name: 'Content / Entertainment',
    keywords: ['netflix', 'disney', 'spotify', 'youtube', 'streaming', 'music', 'video',
               'gaming', 'twitch', 'hbo', 'apple tv', 'paramount']
  },
  device_hardware: {
    name: 'Device / Hardware',
    keywords: ['iphone', 'ipad', 'macbook', 'pixel', 'samsung galaxy', 'surface', 'airpods',
               'apple watch', 'vision pro', 'quest', 'headset', 'wearable', 'laptop', 'phone',
               'switch', 'playstation', 'xbox']
  },
  app_platform: {
    name: 'App / Platform',
    keywords: ['app store', 'play store', 'ios', 'android', 'windows', 'macos', 'linux',
               'software', 'platform', 'developer', 'api']
  },
  ev_autonomous: {
    name: 'EV / Autonomous',
    keywords: ['tesla', 'ev', 'electric vehicle', 'waymo', 'cruise', 'autonomous', 'self-driving',
               'robotaxi', 'rivian', 'lucid', 'byd', 'nio', 'xpeng', 'charging', 'battery']
  },
  space: {
    name: 'Space',
    keywords: ['spacex', 'starlink', 'starship', 'nasa', 'rocket', 'satellite', 'orbit',
               'blue origin', 'virgin galactic', 'kuiper']
  },
  crypto: {
    name: 'Crypto / Blockchain',
    keywords: ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'stablecoin', 'defi', 'nft',
               'web3', 'coinbase', 'binance', 'token', 'wallet']
  },
  regulation: {
    name: 'Regulation',
    keywords: ['antitrust', 'regulation', 'ftc', 'doj', 'eu', 'gdpr', 'privacy', 'lawsuit',
               'fine', 'compliance', 'congress', 'senate', 'bill', 'law']
  },
  business: {
    name: 'Business / Finance',
    keywords: ['earnings', 'revenue', 'profit', 'ipo', 'acquisition', 'merger', 'layoff',
               'valuation', 'funding', 'investment', 'stock', 'market cap']
  }
};

module.exports = { SOURCES, BIG_TECH_KEYWORDS, CATEGORIES };
