import {
  Router,
  type Request,
  type Response,
  type Router as RouterType,
} from 'express';
import { authMiddleware } from '../middleware/auth';

export const stocksRouter: RouterType = Router();

stocksRouter.use(authMiddleware);

// Simple in-memory cache for stock quotes (to respect rate limits)
interface CachedQuote {
  data: StockQuote;
  timestamp: number;
}

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

const quoteCache = new Map<string, CachedQuote>();
const CACHE_TTL = 15000; // 15 seconds cache

// Check if Finnhub API is configured
stocksRouter.get('/config', (_req: Request, res: Response) => {
  const apiKey = process.env.FINNHUB_API_KEY;
  res.json({
    available: !!apiKey,
    provider: 'finnhub',
  });
});

// Get quote for a single stock
stocksRouter.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: 'Stock quotes API not configured',
        message: 'Set FINNHUB_API_KEY environment variable to enable live quotes',
      });
    }

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const upperSymbol = symbol.toUpperCase();

    // Check cache first
    const cached = quoteCache.get(upperSymbol);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({ quote: cached.data, cached: true });
    }

    // Fetch from Finnhub
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${upperSymbol}&token=${apiKey}`;
    const quoteResponse = await fetch(quoteUrl);

    if (!quoteResponse.ok) {
      console.error(`[Stocks] Finnhub API error: ${quoteResponse.status}`);
      return res.status(quoteResponse.status).json({ error: 'Failed to fetch quote' });
    }

    const quoteData = await quoteResponse.json();

    // Check if we got valid data (Finnhub returns empty object for invalid symbols)
    if (!quoteData.c && quoteData.c !== 0) {
      return res.status(404).json({ error: 'Symbol not found' });
    }

    // Fetch company profile for the name
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${upperSymbol}&token=${apiKey}`;
    const profileResponse = await fetch(profileUrl);
    const profileData = profileResponse.ok ? await profileResponse.json() : {};

    const quote: StockQuote = {
      symbol: upperSymbol,
      name: profileData.name || upperSymbol,
      price: quoteData.c, // Current price
      change: quoteData.d, // Change
      changePercent: quoteData.dp, // Change percent
      high: quoteData.h, // High of the day
      low: quoteData.l, // Low of the day
      open: quoteData.o, // Open price
      previousClose: quoteData.pc, // Previous close
      timestamp: quoteData.t * 1000, // Convert to milliseconds
    };

    // Cache the result
    quoteCache.set(upperSymbol, { data: quote, timestamp: Date.now() });

    res.json({ quote, cached: false });
  } catch (error) {
    console.error('[Stocks] Error fetching quote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get quotes for multiple stocks (batch request)
stocksRouter.post('/quotes', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body;
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: 'Stock quotes API not configured',
        message: 'Set FINNHUB_API_KEY environment variable to enable live quotes',
      });
    }

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array is required' });
    }

    // Limit to 10 symbols per request to respect rate limits
    const limitedSymbols = symbols.slice(0, 10).map((s: string) => s.toUpperCase());

    const quotes: StockQuote[] = [];
    const errors: { symbol: string; error: string }[] = [];

    // Fetch quotes in parallel (with some rate limiting)
    await Promise.all(
      limitedSymbols.map(async (symbol: string) => {
        try {
          // Check cache first
          const cached = quoteCache.get(symbol);
          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            quotes.push(cached.data);
            return;
          }

          const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
          const quoteResponse = await fetch(quoteUrl);

          if (!quoteResponse.ok) {
            errors.push({ symbol, error: `API error: ${quoteResponse.status}` });
            return;
          }

          const quoteData = await quoteResponse.json();

          if (!quoteData.c && quoteData.c !== 0) {
            errors.push({ symbol, error: 'Symbol not found' });
            return;
          }

          const quote: StockQuote = {
            symbol,
            name: symbol, // Skip profile fetch for batch to save API calls
            price: quoteData.c,
            change: quoteData.d,
            changePercent: quoteData.dp,
            high: quoteData.h,
            low: quoteData.l,
            open: quoteData.o,
            previousClose: quoteData.pc,
            timestamp: quoteData.t * 1000,
          };

          quoteCache.set(symbol, { data: quote, timestamp: Date.now() });
          quotes.push(quote);
        } catch (err) {
          errors.push({
            symbol,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      })
    );

    res.json({ quotes, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error('[Stocks] Error fetching quotes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search for stocks by keyword
stocksRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: 'Stock quotes API not configured',
      });
    }

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchUrl = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${apiKey}`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Search failed' });
    }

    const data = await response.json();

    // Return top 10 results
    const results = (data.result || []).slice(0, 10).map((item: any) => ({
      symbol: item.symbol,
      name: item.description,
      type: item.type,
    }));

    res.json({ results });
  } catch (error) {
    console.error('[Stocks] Error searching:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get market status
stocksRouter.get('/market-status', (_req: Request, res: Response) => {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etTime.getDay();
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  let status: 'open' | 'pre-market' | 'after-hours' | 'closed';
  let nextEvent: string;

  if (day === 0 || day === 6) {
    status = 'closed';
    nextEvent = 'Opens Monday 9:30 AM ET';
  } else if (currentMinutes < marketOpen) {
    status = 'pre-market';
    nextEvent = 'Opens 9:30 AM ET';
  } else if (currentMinutes >= marketClose) {
    status = 'after-hours';
    nextEvent = 'Opens tomorrow 9:30 AM ET';
  } else {
    status = 'open';
    const minutesLeft = marketClose - currentMinutes;
    const hoursLeft = Math.floor(minutesLeft / 60);
    const minsLeft = minutesLeft % 60;
    nextEvent = `Closes in ${hoursLeft}h ${minsLeft}m`;
  }

  res.json({
    status,
    nextEvent,
    currentTime: etTime.toISOString(),
    timezone: 'America/New_York',
  });
});

// Cache for fundamentals data (longer TTL since this data doesn't change frequently)
interface CachedFundamentals {
  data: StockFundamentals;
  timestamp: number;
}

interface StockFundamentals {
  symbol: string;
  name: string;
  peRatio: number | null;
  forwardPE: number | null;
  eps: number | null;
  marketCap: number | null;
  revenue: number | null;
  revenueGrowth: number | null;
  grossMargin: number | null;
  lastEarnings: {
    actual: number | null;
    estimate: number | null;
    surprise: number | null;
    surprisePercent: number | null;
    period: string | null;
  } | null;
}

const fundamentalsCache = new Map<string, CachedFundamentals>();
const FUNDAMENTALS_CACHE_TTL = 300000; // 5 minutes (fundamentals don't change frequently)

// Get fundamental metrics for a stock (on-demand)
stocksRouter.get('/fundamentals/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: 'Stock API not configured',
        message: 'Set FINNHUB_API_KEY environment variable to enable fundamentals',
      });
    }

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const upperSymbol = symbol.toUpperCase();

    // Check cache first
    const cached = fundamentalsCache.get(upperSymbol);
    if (cached && Date.now() - cached.timestamp < FUNDAMENTALS_CACHE_TTL) {
      return res.json({ fundamentals: cached.data, cached: true });
    }

    // Fetch basic metrics from Finnhub
    const metricsUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${upperSymbol}&metric=all&token=${apiKey}`;
    const metricsResponse = await fetch(metricsUrl);

    if (!metricsResponse.ok) {
      console.error(`[Stocks] Finnhub metrics API error: ${metricsResponse.status}`);
      return res.status(metricsResponse.status).json({ error: 'Failed to fetch fundamentals' });
    }

    const metricsData = await metricsResponse.json();

    // Fetch earnings data
    const earningsUrl = `https://finnhub.io/api/v1/stock/earnings?symbol=${upperSymbol}&token=${apiKey}`;
    const earningsResponse = await fetch(earningsUrl);
    const earningsData = earningsResponse.ok ? await earningsResponse.json() : [];

    // Get most recent earnings
    const lastEarningsRaw = Array.isArray(earningsData) && earningsData.length > 0
      ? earningsData[0]
      : null;

    // Fetch company profile for name
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${upperSymbol}&token=${apiKey}`;
    const profileResponse = await fetch(profileUrl);
    const profileData = profileResponse.ok ? await profileResponse.json() : {};

    const metric = metricsData.metric || {};

    const fundamentals: StockFundamentals = {
      symbol: upperSymbol,
      name: profileData.name || upperSymbol,
      peRatio: metric.peBasicExclExtraTTM ?? metric.peExclExtraTTM ?? null,
      forwardPE: metric.forwardPE ?? null,
      eps: metric.epsBasicExclExtraItemsTTM ?? metric.epsTTM ?? null,
      marketCap: profileData.marketCapitalization ? profileData.marketCapitalization * 1000000 : null, // Convert to actual value
      revenue: metric.revenueTTM ? metric.revenueTTM * 1000000 : null, // Convert to actual value
      revenueGrowth: metric.revenueGrowthTTMYoy ?? metric.revenueGrowth5Y ?? null,
      grossMargin: metric.grossMarginTTM ?? null,
      lastEarnings: lastEarningsRaw ? {
        actual: lastEarningsRaw.actual ?? null,
        estimate: lastEarningsRaw.estimate ?? null,
        surprise: lastEarningsRaw.surprise ?? null,
        surprisePercent: lastEarningsRaw.surprisePercent ?? null,
        period: lastEarningsRaw.period ?? null,
      } : null,
    };

    // Cache the result
    fundamentalsCache.set(upperSymbol, { data: fundamentals, timestamp: Date.now() });

    res.json({ fundamentals, cached: false });
  } catch (error) {
    console.error('[Stocks] Error fetching fundamentals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
