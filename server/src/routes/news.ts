import {
  Router,
  type Request,
  type Response,
  type Router as RouterType,
} from 'express';
import { SECTORS, classifySector } from '../config/sectors';

export const newsRouter: RouterType = Router();

interface RssHeadline {
  headline: string;
  source: string;
  publishedAt: string;
  link: string;
  sectorId: string | null;
}

// Simple RSS XML parser using regex (no dependencies needed)
function parseRssItems(xml: string): Array<{
  title: string;
  source: string;
  pubDate: string;
  link: string;
}> {
  const items: Array<{
    title: string;
    source: string;
    pubDate: string;
    link: string;
  }> = [];

  // Match all <item>...</item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  match = itemRegex.exec(xml);
  while (match !== null) {
    const block = match[1];

    const titleMatch = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/.exec(
      block,
    );
    const sourceMatch =
      /<source[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/source>/.exec(block);
    const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(block);
    const linkMatch = /<link>(.*?)<\/link>/.exec(block);

    if (titleMatch?.[1]) {
      // Clean up HTML entities
      const title = titleMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/ - .*$/, ''); // Remove " - SourceName" suffix from Google News

      items.push({
        title: title.trim(),
        source: sourceMatch?.[1]?.trim() || 'Google News',
        pubDate: pubDateMatch?.[1]?.trim() || new Date().toISOString(),
        link: linkMatch?.[1]?.trim() || '',
      });
    }

    match = itemRegex.exec(xml);
  }

  return items;
}

// Pre-compute all tickers from SECTORS for substance checking
const ALL_TICKERS = new Set(
  Object.values(SECTORS).flatMap((s) => s.tickers),
);

const FINANCIAL_ACTION_WORDS = new Set([
  'rises', 'falls', 'beats', 'misses', 'reports', 'announces',
  'acquires', 'launches', 'files', 'cuts', 'raises', 'surges',
  'drops', 'plunges', 'soars', 'rally', 'rallies', 'earnings',
  'revenue', 'profit', 'loss', 'dividend', 'buyback', 'merger',
  'ipo', 'guidance', 'forecast', 'downgrade', 'upgrade', 'recall',
  'settlement', 'lawsuit', 'bankruptcy', 'layoffs', 'hiring',
  'outlook', 'target', 'rating', 'shares', 'stock',
]);

const LOW_QUALITY_PATTERNS = [
  /^\d+\s+(things|stocks|ways|reasons|tips)/i,
  /what to watch/i,
  /morning briefing/i,
  /daily roundup/i,
  /here'?s what/i,
  /weekly wrap/i,
  /market recap/i,
  /newsletter/i,
];

// Known company names derived from tickers for matching in headlines
const COMPANY_NAMES = new Set([
  'apple', 'microsoft', 'nvidia', 'google', 'alphabet', 'meta',
  'broadcom', 'salesforce', 'adobe', 'amd', 'intel', 'qualcomm',
  'johnson & johnson', 'unitedhealth', 'pfizer', 'abbvie', 'merck',
  'eli lilly', 'moderna', 'exxon', 'chevron', 'conocophillips',
  'schlumberger', 'jpmorgan', 'bank of america', 'goldman sachs',
  'morgan stanley', 'wells fargo', 'blackrock', 'visa', 'paypal',
  'amazon', 'tesla', 'home depot', 'nike', 'starbucks', 'mcdonalds',
  'target', 'disney', 'netflix', 'uber', 'boeing', 'caterpillar',
  'honeywell', 'ups', 'raytheon', 'lockheed',
]);

function isSubstantiveHeadline(headline: string): boolean {
  const words = headline.split(/\s+/);

  // Reject short headlines (< 8 words)
  if (words.length < 8) return false;

  // Reject known low-quality patterns
  for (const pattern of LOW_QUALITY_PATTERNS) {
    if (pattern.test(headline)) return false;
  }

  const upper = headline.toUpperCase();
  const lower = headline.toLowerCase();
  let signals = 0;

  // Signal 1: Company/ticker mention
  const hasCompany =
    [...ALL_TICKERS].some((t) => upper.includes(t)) ||
    [...COMPANY_NAMES].some((name) => lower.includes(name));
  if (hasCompany) signals++;

  // Signal 2: Financial action verb
  const hasAction = words.some((w) =>
    FINANCIAL_ACTION_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')),
  );
  if (hasAction) signals++;

  // Signal 3: Numeric specificity (numbers, percentages, dollar amounts, quarters)
  const hasNumeric = /\d/.test(headline) ||
    /\$[\d.]+[BMK]?/i.test(headline) ||
    /\d+%/.test(headline) ||
    /Q[1-4]/i.test(headline);
  if (hasNumeric) signals++;

  // Signal 4: Minimum word count (10+ words is a strong signal of substance)
  if (words.length >= 10) signals++;

  return signals >= 2;
}

// Pre-compute RSS URLs at module level (sectors are static)
const RSS_URLS: Array<{ sectorId: string; url: string }> = Object.entries(
  SECTORS,
).map(([sectorId, config]) => {
  const query = config.tickers
    .slice(0, 4)
    .map((t) => `${t}+stock`)
    .join('+OR+');
  return {
    sectorId,
    url: `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
  };
});

// Cache for fetched headlines (refresh every 10 minutes)
let headlineCache: RssHeadline[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchRealHeadlines(): Promise<RssHeadline[]> {
  const now = Date.now();
  if (headlineCache.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return headlineCache;
  }

  console.log('[News] Fetching real headlines from RSS feeds...');
  const allHeadlines: RssHeadline[] = [];
  const seenTitles = new Set<string>();
  let totalRawCount = 0;

  // Fetch all sector feeds in parallel
  const results = await Promise.allSettled(
    RSS_URLS.map(async ({ sectorId, url }) => {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
          console.warn(
            `[News] RSS fetch failed for ${sectorId}: ${response.status}`,
          );
          return [];
        }

        const xml = await response.text();
        const items = parseRssItems(xml);

        return items.map((item) => ({
          headline: item.title,
          source: item.source,
          publishedAt: item.pubDate,
          link: item.link,
          sectorId: classifySector(item.title) || sectorId,
        }));
      } catch (error) {
        console.warn(`[News] RSS error for ${sectorId}:`, error);
        return [];
      }
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalRawCount += result.value.length;
      for (const headline of result.value) {
        // Deduplicate by title, filter for substance
        const key = headline.headline.toLowerCase().slice(0, 60);
        if (!seenTitles.has(key) && isSubstantiveHeadline(headline.headline)) {
          seenTitles.add(key);
          allHeadlines.push(headline);
        }
      }
    }
  }

  console.log(
    `[News] Fetched ${totalRawCount} headlines, ${allHeadlines.length} passed substance filter`,
  );

  if (allHeadlines.length > 0) {
    headlineCache = allHeadlines;
    lastFetchTime = now;
  }

  return allHeadlines;
}

// GET /api/news/headlines - Returns real financial headlines
newsRouter.get('/headlines', async (_req: Request, res: Response) => {
  try {
    const real = await fetchRealHeadlines();

    if (real.length > 0) {
      // Return up to 50, shuffled for variety
      const shuffled = [...real].sort(() => Math.random() - 0.5);
      return res.json({
        headlines: shuffled.slice(0, 50),
        source: 'rss',
        count: Math.min(shuffled.length, 50),
      });
    }

    // Fallback: return empty so frontend uses its own fallback
    res.json({
      headlines: [],
      source: 'none',
      count: 0,
    });
  } catch (error) {
    console.error('[News] Headlines error:', error);
    res.json({ headlines: [], source: 'error', count: 0 });
  }
});

// Export the fetch function so sectors route can use it for seeding
export { fetchRealHeadlines };
