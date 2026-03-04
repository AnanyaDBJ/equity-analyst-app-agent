export const SECTORS: Record<
  string,
  {
    label: string;
    icon: string;
    color: string;
    tickers: string[];
    keywords: string[];
  }
> = {
  technology: {
    label: 'Technology',
    icon: 'Monitor',
    color: '#3b82f6',
    tickers: [
      'AAPL',
      'MSFT',
      'NVDA',
      'GOOGL',
      'META',
      'AVGO',
      'CRM',
      'ADBE',
      'AMD',
      'INTC',
      'QCOM',
    ],
    keywords: [
      'tech',
      'software',
      'AI',
      'semiconductor',
      'cloud',
      'SaaS',
      'chip',
      'iPhone',
      'Azure',
      'GPU',
    ],
  },
  healthcare: {
    label: 'Healthcare',
    icon: 'Heart',
    color: '#22c55e',
    tickers: ['JNJ', 'UNH', 'PFE', 'ABBV', 'MRK', 'LLY', 'TMO', 'MODERNA'],
    keywords: [
      'pharma',
      'biotech',
      'FDA',
      'drug',
      'vaccine',
      'clinical',
      'hospital',
      'health',
    ],
  },
  energy: {
    label: 'Energy',
    icon: 'Zap',
    color: '#f59e0b',
    tickers: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'OXY'],
    keywords: [
      'oil',
      'gas',
      'energy',
      'petroleum',
      'crude',
      'OPEC',
      'renewable',
      'solar',
    ],
  },
  financials: {
    label: 'Financials',
    icon: 'DollarSign',
    color: '#8b5cf6',
    tickers: ['JPM', 'BAC', 'GS', 'MS', 'WFC', 'BLK', 'C', 'VISA', 'PAYPAL'],
    keywords: [
      'bank',
      'financial',
      'loan',
      'interest rate',
      'Fed',
      'treasury',
      'S&P',
    ],
  },
  consumer: {
    label: 'Consumer',
    icon: 'ShoppingBag',
    color: '#ec4899',
    tickers: [
      'AMZN',
      'TSLA',
      'HD',
      'NKE',
      'SBUX',
      'MCD',
      'TGT',
      'DIS',
      'NFLX',
      'UBER',
    ],
    keywords: [
      'retail',
      'consumer',
      'e-commerce',
      'subscriber',
      'delivery',
      'streaming',
    ],
  },
  industrials: {
    label: 'Industrials',
    icon: 'Factory',
    color: '#06b6d4',
    tickers: ['BA', 'CAT', 'HON', 'UPS', 'GE', 'RTX', 'LMT'],
    keywords: [
      'industrial',
      'manufacturing',
      'defense',
      'aerospace',
      'Boeing',
      'FAA',
    ],
  },
};

// Pre-compute lowercase keywords to avoid allocations on every call
const SECTOR_ENTRIES = Object.entries(SECTORS).map(([sectorId, config]) => ({
  sectorId,
  tickers: config.tickers,
  keywordsLower: config.keywords.map((k) => k.toLowerCase()),
}));

export function classifySector(headline: string): string | null {
  const upper = headline.toUpperCase();
  const lower = headline.toLowerCase();
  for (const { sectorId, tickers, keywordsLower } of SECTOR_ENTRIES) {
    for (const ticker of tickers) {
      if (upper.includes(ticker)) return sectorId;
    }
    for (const keyword of keywordsLower) {
      if (lower.includes(keyword)) return sectorId;
    }
  }
  return null;
}

export function computeImpactScore(
  sentimentScore: number,
  confidencePercent: number,
): number {
  const magnitude = Math.abs(sentimentScore - 0.5) * 2;
  return magnitude * (confidencePercent / 100);
}
