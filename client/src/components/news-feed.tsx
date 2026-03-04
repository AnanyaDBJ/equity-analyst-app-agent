import { useState, useEffect, useMemo, useRef, useCallback, useTransition, lazy, Suspense } from 'react';
import { Send, Loader2, TrendingUp, TrendingDown, Minus, Trash2, ServerOff, LayoutGrid, RefreshCw, Database, Filter, X, PanelRightOpen, PanelRightClose, Play, Pause, Radio, LineChart, ChevronDown, ChevronUp, SlidersHorizontal, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SentimentDashboard } from './sentiment-dashboard';
import { useActiveTab } from '@/contexts/ActiveTabContext';
import { MarketIndicesHeader } from './market-indices';
import { SectorImpactBanner } from './sector-impact-banner';
import { mutate as mutateGlobal } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load the TradingView widget to prevent page hanging
const TradingViewSearchableChart = lazy(() =>
  import('./trading-view-widget').then(module => ({ default: module.TradingViewSearchableChart }))
);

interface NewsAnalysis {
  id: string;
  headline: string;
  company: string;
  status: 'bullish' | 'bearish' | 'neutral';
  confidence: string;
  confidencePercent: number;
  sentimentScore: number;
  rationale: string;
  timestamp: string;
  isLoading?: boolean;
}

interface TableColumn {
  name: string;
  type: string;
}

interface TableData {
  columns: TableColumn[];
  rows: unknown[][];
  rowCount: number;
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

// Map company names to stock symbols for fundamentals lookup
const COMPANY_TO_SYMBOL: Record<string, string> = {
  'apple': 'AAPL',
  'microsoft': 'MSFT',
  'google': 'GOOGL',
  'alphabet': 'GOOGL',
  'amazon': 'AMZN',
  'meta': 'META',
  'facebook': 'META',
  'nvidia': 'NVDA',
  'tesla': 'TSLA',
  'netflix': 'NFLX',
  'jpmorgan': 'JPM',
  'jp morgan': 'JPM',
  'goldman': 'GS',
  'goldman sachs': 'GS',
  'bank of america': 'BAC',
  'wells fargo': 'WFC',
  'morgan stanley': 'MS',
  'pfizer': 'PFE',
  'johnson & johnson': 'JNJ',
  'unitedhealth': 'UNH',
  'exxon': 'XOM',
  'chevron': 'CVX',
  'walmart': 'WMT',
  'costco': 'COST',
  'home depot': 'HD',
  'disney': 'DIS',
  'coca-cola': 'KO',
  'pepsi': 'PEP',
  'pepsico': 'PEP',
  'boeing': 'BA',
  'intel': 'INTC',
  'amd': 'AMD',
  'salesforce': 'CRM',
  'adobe': 'ADBE',
  'oracle': 'ORCL',
  'ibm': 'IBM',
  'cisco': 'CSCO',
  'visa': 'V',
  'mastercard': 'MA',
  'paypal': 'PYPL',
  'berkshire': 'BRK.B',
  'berkshire hathaway': 'BRK.B',
};

// Try to get stock symbol from company name
const getSymbolFromCompany = (company: string): string | null => {
  if (!company) return null;
  const lower = company.toLowerCase().trim();
  // Direct match
  if (COMPANY_TO_SYMBOL[lower]) return COMPANY_TO_SYMBOL[lower];
  // Check if company name contains a known company
  for (const [name, symbol] of Object.entries(COMPANY_TO_SYMBOL)) {
    if (lower.includes(name) || name.includes(lower)) return symbol;
  }
  // If company looks like a ticker (all caps, 1-5 letters), use it directly
  if (/^[A-Z]{1,5}$/.test(company)) return company;
  return null;
};

// Fallback headlines used when real RSS feed is unavailable (50 across all sectors)
const FALLBACK_HEADLINES = [
  // Technology (10)
  "Apple announces record-breaking iPhone sales in Q4, beating analyst expectations by 15%",
  "NVIDIA shares surge 8% after unveiling next-generation AI chips with 3x performance gains",
  "Microsoft Azure revenue grows 29% YoY, cloud division now accounts for 50% of total revenue",
  "Google parent Alphabet announces $70 billion stock buyback program",
  "Meta Platforms faces EU antitrust investigation, potential $2B fine looms",
  "Intel warns of weaker-than-expected guidance, cites PC market slowdown",
  "AMD gains market share in data center CPUs, stock rises on positive analyst coverage",
  "Salesforce acquires AI startup for $2.8 billion to boost Einstein platform",
  "Qualcomm settles patent dispute with Huawei, opens new revenue stream",
  "NVIDIA data center revenue doubles to $26B as AI spending accelerates globally",
  // Healthcare (8)
  "Moderna begins Phase 3 trials for combined flu-COVID vaccine",
  "Eli Lilly weight loss drug sales top $5B in first full quarter on market",
  "Pfizer announces $43B acquisition of cancer therapy biotech startup",
  "UnitedHealth Group raises full-year guidance on strong Medicare Advantage enrollment",
  "FDA fast-tracks approval for breakthrough Alzheimer's drug from Merck",
  "Johnson & Johnson spins off consumer health division in $40B deal",
  "AbbVie reports Humira biosimilar competition less severe than feared",
  "Biotech stocks rally as clinical trial data shows 90% efficacy in rare disease treatment",
  // Energy (8)
  "ExxonMobil reports record quarterly profit on strong refining margins",
  "OPEC+ agrees to extend production cuts through Q3, crude oil rises 4%",
  "Chevron completes $53B acquisition of Hess, creating energy mega-giant",
  "Solar installations hit record high as panel costs drop 20% globally",
  "US crude oil inventories fall to lowest level in 18 months, prices surge",
  "Schlumberger sees 15% rise in international drilling activity for 2026",
  "ConocoPhillips discovers major offshore oil field in Gulf of Mexico",
  "European natural gas prices spike 30% on supply disruption fears",
  // Financials (8)
  "JPMorgan raises S&P 500 target to 5,500 citing strong corporate earnings",
  "Goldman Sachs downgrades retail sector, warns of consumer spending slowdown",
  "Visa reports 12% increase in cross-border transactions, international travel booms",
  "PayPal cuts 2,000 jobs amid fintech sector restructuring, shares dip 3%",
  "Federal Reserve holds rates steady, signals potential cut in September",
  "Bank of America reports 22% jump in investment banking revenue",
  "Morgan Stanley wealth management division hits record $5T in client assets",
  "BlackRock AUM surpasses $11 trillion milestone on ETF inflows surge",
  // Consumer (8)
  "Amazon Web Services wins $10 billion Pentagon contract, shares jump 4%",
  "Tesla reports disappointing delivery numbers, stock falls 5% in pre-market trading",
  "Netflix subscriber growth exceeds expectations, adds 13 million new users globally",
  "Disney+ reaches 150 million subscribers, narrows streaming losses significantly",
  "Uber reports first annual profit in company history, shares rally 10%",
  "Nike revenue misses estimates as China demand weakens, shares drop 6%",
  "Starbucks same-store sales fall 3% in US as consumers cut discretionary spending",
  "Target beats earnings expectations with strong grocery and essentials growth",
  // Industrials (8)
  "Boeing 737 MAX receives FAA approval for expanded operations in Asia",
  "Caterpillar raises full-year guidance on infrastructure spending boom",
  "Lockheed Martin wins $15B defense contract for next-gen fighter jets",
  "UPS announces 12,000 layoffs as package volume continues to decline",
  "Honeywell completes acquisition of Carrier Global for $5B in industrial consolidation",
  "General Electric Vernova sees record wind turbine orders amid renewable energy push",
  "Raytheon delivers first batch of next-gen air defense systems to NATO allies",
  "Boeing faces new scrutiny as whistleblower reports quality concerns on 787 Dreamliner",
];

// Parse sentiment endpoint response into NewsAnalysis format
const parseAnalysisResponse = (id: string, headline: string, response: unknown): NewsAnalysis => {
  console.log('[NewsFeed] Parsing response:', JSON.stringify(response, null, 2));

  // Default values
  let status: NewsAnalysis['status'] = 'neutral';
  let confidence = 'medium';
  let confidencePercent = 70;
  let sentimentScore = 0.5;
  let rationale = '';
  let company = '';

  // Try to extract data from the response
  if (typeof response === 'object' && response !== null) {
    let data = response as Record<string, unknown>;

    // Unwrap common serving endpoint response wrappers
    if ('predictions' in data && Array.isArray(data.predictions) && data.predictions.length > 0) {
      console.log('[NewsFeed] Unwrapping predictions array');
      data = data.predictions[0] as Record<string, unknown>;
    } else if ('output' in data && Array.isArray(data.output) && data.output.length > 0) {
      // Handle output as array of messages (agent response format)
      console.log('[NewsFeed] Unwrapping output array (agent format)');
      const message = data.output[0] as Record<string, unknown>;
      if ('content' in message && Array.isArray(message.content)) {
        // Find output_text content and parse its text field
        for (const contentItem of message.content) {
          const item = contentItem as Record<string, unknown>;
          if (item.type === 'output_text' && typeof item.text === 'string') {
            console.log('[NewsFeed] Found output_text, parsing JSON from text field');
            try {
              data = JSON.parse(item.text) as Record<string, unknown>;
              console.log('[NewsFeed] Parsed JSON data:', JSON.stringify(data, null, 2));
              break;
            } catch (e) {
              console.error('[NewsFeed] Failed to parse text as JSON:', e);
            }
          }
        }
      }
    } else if ('output' in data && typeof data.output === 'object' && data.output !== null) {
      console.log('[NewsFeed] Unwrapping output object');
      data = data.output as Record<string, unknown>;
    }

    console.log('[NewsFeed] Data after unwrapping:', JSON.stringify(data, null, 2));

    // Extract company
    if ('company' in data && typeof data.company === 'string' && data.company) {
      company = data.company;
    }

    // Handle structured output format with sentiment_analysis object
    if ('sentiment_analysis' in data && typeof data.sentiment_analysis === 'object' && data.sentiment_analysis !== null) {
      const sentimentData = data.sentiment_analysis as Record<string, unknown>;

      // Extract status (bullish/bearish/neutral)
      if ('status' in sentimentData && typeof sentimentData.status === 'string') {
        const s = sentimentData.status.toLowerCase();
        if (s.includes('bull') || s.includes('positive')) status = 'bullish';
        else if (s.includes('bear') || s.includes('negative')) status = 'bearish';
        else status = 'neutral';
      }

      // Extract confidence (keep raw value and calculate percent)
      if ('confidence' in sentimentData) {
        confidence = String(sentimentData.confidence).toLowerCase();
        if (confidence === 'high') confidencePercent = 90;
        else if (confidence === 'medium') confidencePercent = 70;
        else if (confidence === 'low') confidencePercent = 50;
      }

      // Extract sentiment_score (raw value)
      if ('sentiment_score' in sentimentData && typeof sentimentData.sentiment_score === 'number') {
        sentimentScore = sentimentData.sentiment_score;
      }

      // Extract rationale
      if ('rationale' in sentimentData && typeof sentimentData.rationale === 'string') {
        rationale = sentimentData.rationale;
      }
    }
  }

  return {
    id,
    headline,
    company,
    status,
    confidence,
    confidencePercent,
    sentimentScore,
    rationale: rationale || 'Analysis completed.',
    timestamp: new Date().toISOString(),
  };
};

// Analyze news using the sentiment endpoint
const analyzeNews = async (id: string, headline: string): Promise<NewsAnalysis> => {
  const response = await fetch('/api/sentiment/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ headline }),
  });

  if (!response.ok) {
    throw new Error('Failed to analyze headline');
  }

  const result = await response.json();
  const parsed = parseAnalysisResponse(id, headline, result);
  // Use the savedId from the server response if available
  if (result.savedId) {
    parsed.id = result.savedId;
  }
  // Revalidate sector banner so new analysis appears immediately
  mutateGlobal('/api/sectors/banner');
  return parsed;
};

// Fetch sentiment analysis history from database
const fetchHistory = async (): Promise<NewsAnalysis[]> => {
  const response = await fetch('/api/sentiment/history?limit=50');
  if (!response.ok) {
    throw new Error('Failed to fetch history');
  }
  const data = await response.json();
  return (data.analyses || []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    headline: a.headline as string,
    company: (a.company as string) || '',
    status: a.status as NewsAnalysis['status'],
    confidence: a.confidence as string,
    confidencePercent: a.confidencePercent as number,
    sentimentScore: a.sentimentScore as number,
    rationale: (a.rationale as string) || 'Analysis completed.',
    timestamp: a.createdAt as string,
  }));
};

// Clear all sentiment analyses from database
const clearHistory = async (): Promise<void> => {
  const response = await fetch('/api/sentiment/history', {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to clear history');
  }
};

// Fetch Delta table data
const fetchTableData = async (tableName: string): Promise<TableData> => {
  const response = await fetch('/api/sql/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `SELECT * FROM ${tableName}`,
      limit: 50,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch table data');
  }

  return response.json();
};

const SentimentBadge = ({ status }: { status: NewsAnalysis['status'] }) => {
  const config = {
    bullish: { icon: TrendingUp, color: 'text-green-400 bg-green-400/10 border-green-400/30' },
    bearish: { icon: TrendingDown, color: 'text-red-400 bg-red-400/10 border-red-400/30' },
    neutral: { icon: Minus, color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  };

  const { icon: Icon, color } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium text-sm capitalize ${color}`}>
      <Icon className="h-4 w-4" />
      {status}
    </span>
  );
};

// Format large numbers for display (e.g., 2800000000 -> "$2.8T")
const formatLargeNumber = (num: number | null): string => {
  if (num === null) return '-';
  const absNum = Math.abs(num);
  if (absNum >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
  if (absNum >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (absNum >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  return `$${num.toLocaleString()}`;
};

const NewsCard = ({ analysis }: { analysis: NewsAnalysis }) => {
  const [showMetrics, setShowMetrics] = useState(false);
  const [fundamentals, setFundamentals] = useState<StockFundamentals | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const symbol = getSymbolFromCompany(analysis.company);

  const fetchFundamentals = async () => {
    if (!symbol || fundamentals) return; // Don't re-fetch if we have data
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const response = await fetch(`/api/stocks/fundamentals/${symbol}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setFundamentals(data.fundamentals);
    } catch (err) {
      setMetricsError('Failed to load metrics');
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleMetricsClick = () => {
    if (!showMetrics && !fundamentals) {
      fetchFundamentals();
    }
    setShowMetrics(!showMetrics);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      {analysis.isLoading ? (
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <h3 className="font-medium text-white leading-snug">{analysis.headline}</h3>
            <p className='mt-1 text-sm text-white/50'>Analyzing...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-start justify-between gap-4">
            <h3 className="font-medium text-white leading-snug">{analysis.headline}</h3>
            <SentimentBadge status={analysis.status} />
          </div>

          <p className="mb-4 text-sm text-white/70 leading-relaxed">{analysis.rationale}</p>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-white/5 p-3">
              <div className='mb-1 text-white/50 text-xs'>Company</div>
              <div className="font-semibold text-white">{analysis.company || '-'}</div>
            </div>

            <div className="rounded-lg bg-white/5 p-3">
              <div className='mb-1 text-white/50 text-xs'>Status</div>
              <div className="font-semibold text-white capitalize">{analysis.status}</div>
            </div>

            <div className="rounded-lg bg-white/5 p-3">
              <div className='mb-1 text-white/50 text-xs'>Sentiment Score</div>
              <div className="font-semibold text-white">{analysis.sentimentScore.toFixed(2)}</div>
            </div>

            <div className="rounded-lg bg-white/5 p-3">
              <div className='mb-1 text-white/50 text-xs'>Confidence</div>
              <div className="font-semibold text-white capitalize">{analysis.confidence} ({analysis.confidencePercent}%)</div>
            </div>
          </div>

          {/* Metrics Button - only show if we can identify a symbol */}
          {symbol && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 text-white/60 hover:bg-white/10 hover:text-white ${showMetrics ? 'bg-white/10 text-white' : ''}`}
                onClick={handleMetricsClick}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                {showMetrics ? 'Hide Metrics' : 'Show Metrics'}
                {metricsLoading && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
              </Button>

              {/* Inline Fundamentals Display */}
              {showMetrics && (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  {metricsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-white/50">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading fundamentals for {symbol}...
                    </div>
                  ) : metricsError ? (
                    <div className="text-sm text-red-400">{metricsError}</div>
                  ) : fundamentals ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                        <div>
                          <span className="text-white/50">P/E:</span>{' '}
                          <span className="font-medium text-white">
                            {fundamentals.peRatio?.toFixed(1) ?? '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/50">MCap:</span>{' '}
                          <span className="font-medium text-white">
                            {formatLargeNumber(fundamentals.marketCap)}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/50">EPS:</span>{' '}
                          <span className="font-medium text-white">
                            ${fundamentals.eps?.toFixed(2) ?? '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/50">Revenue:</span>{' '}
                          <span className="font-medium text-white">
                            {formatLargeNumber(fundamentals.revenue)}
                          </span>
                        </div>
                        {fundamentals.revenueGrowth !== null && (
                          <div>
                            <span className="text-white/50">Rev Growth:</span>{' '}
                            <span className={`font-medium ${fundamentals.revenueGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {fundamentals.revenueGrowth >= 0 ? '+' : ''}{fundamentals.revenueGrowth.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                      {fundamentals.lastEarnings && (
                        <div className="text-sm">
                          <span className="text-white/50">Last Earnings:</span>{' '}
                          {fundamentals.lastEarnings.surprisePercent !== null ? (
                            <span className={`font-medium ${fundamentals.lastEarnings.surprisePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {fundamentals.lastEarnings.surprisePercent >= 0 ? 'Beat' : 'Miss'} {fundamentals.lastEarnings.surprisePercent >= 0 ? '+' : ''}{fundamentals.lastEarnings.surprisePercent.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-white/50">-</span>
                          )}
                          {fundamentals.lastEarnings.period && (
                            <span className="ml-2 text-white/40">({fundamentals.lastEarnings.period})</span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface ColumnFilter {
  column: string;
  value: string;
}

const _DeltaTableView = ({
  tableName,
  tableData,
  setTableData,
}: {
  tableName: string;
  tableData: TableData | null;
  setTableData: (data: TableData | null) => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [filterValue, setFilterValue] = useState<string>('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTableData(tableName);
      setTableData(data);
      setHasLoaded(true);
    } catch (err) {
      console.error('Error loading table data:', err);
      setError('Failed to load table data. Please check if the SQL warehouse is available.');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't auto-load - only load when user clicks the button

  // Get unique values for a column for filter suggestions
  const getUniqueValues = (columnIndex: number): string[] => {
    if (!tableData) return [];
    const values = new Set<string>();
    tableData.rows.forEach(row => {
      const val = row[columnIndex];
      if (val !== null && val !== undefined) {
        values.add(String(val));
      }
    });
    return Array.from(values).slice(0, 20); // Limit to 20 unique values
  };

  // Filter rows based on active filters
  const filteredRows = useMemo(() => {
    if (!tableData || filters.length === 0) return tableData?.rows || [];

    return tableData.rows.filter(row => {
      return filters.every(filter => {
        const colIndex = tableData.columns.findIndex(c => c.name === filter.column);
        if (colIndex === -1) return true;
        const cellValue = row[colIndex];
        const cellStr = cellValue === null ? '' : String(cellValue).toLowerCase();
        return cellStr.includes(filter.value.toLowerCase());
      });
    });
  }, [tableData, filters]);

  const addFilter = () => {
    if (selectedColumn && filterValue.trim()) {
      setFilters(prev => [...prev, { column: selectedColumn, value: filterValue.trim() }]);
      setSelectedColumn('');
      setFilterValue('');
      setShowFilterPanel(false);
    }
  };

  const removeFilter = (index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFilters = () => {
    setFilters([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-white/60">Loading table data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
        {error}
        <Button variant="outline" size="sm" className="ml-4" onClick={loadData}>
          <RefreshCw className='mr-2 h-4 w-4' />
          Retry
        </Button>
      </div>
    );
  }

  // Show initial load button if no data has been loaded yet
  if (!tableData && !hasLoaded && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Database className="h-8 w-8 text-primary" />
        </div>
        <h2 className='mb-2 font-semibold text-white text-xl'>Stock History</h2>
        <p className='mb-4 max-w-md text-white/60'>
          Click the button below to load stock history data.
        </p>
        <Button onClick={loadData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Load Data
        </Button>
      </div>
    );
  }

  if (!tableData || tableData.rows.length === 0) {
    return (
      <div className='py-12 text-center text-white/60'>
        No data available in the table.
        <Button variant="outline" size="sm" className="ml-4" onClick={loadData}>
          <RefreshCw className='mr-2 h-4 w-4' />
          Refresh
        </Button>
      </div>
    );
  }

  const selectedColumnIndex = tableData.columns.findIndex(c => c.name === selectedColumn);
  const suggestedValues = selectedColumnIndex >= 0 ? getUniqueValues(selectedColumnIndex) : [];

  return (
    <div className="space-y-4">
      {/* Header with table info and actions */}
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2 text-sm text-white/60'>
          <Database className="h-4 w-4" />
          <span>{tableName}</span>
          <span className="text-white/40">
            ({filteredRows.length}{filters.length > 0 ? ` of ${tableData.rowCount}` : ''} rows)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={showFilterPanel ? 'bg-primary/20' : ''}
          >
            <Filter className='mr-2 h-4 w-4' />
            Add Filter
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className='mr-2 h-4 w-4' />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilterPanel && (
        <div
          className="rounded-lg border border-white/10 bg-white/5 p-4"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className='min-w-[200px] flex-1'>
              <label className='mb-1 block text-white/50 text-xs'>Column</label>
              <select
                value={selectedColumn}
                onChange={(e) => {
                  setSelectedColumn(e.target.value);
                  setFilterValue('');
                }}
                className='w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none'
              >
                <option value="">Select a column...</option>
                {tableData.columns.map((col, i) => (
                  <option key={i} value={col.name}>{col.name}</option>
                ))}
              </select>
            </div>
            <div className='min-w-[200px] flex-1'>
              <label className='mb-1 block text-white/50 text-xs'>Contains value</label>
              <input
                type="text"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                placeholder="Enter filter value..."
                className='w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none'
                list="filter-suggestions"
              />
              {suggestedValues.length > 0 && (
                <datalist id="filter-suggestions">
                  {suggestedValues.map((val, i) => (
                    <option key={i} value={val} />
                  ))}
                </datalist>
              )}
            </div>
            <Button size="sm" onClick={addFilter} disabled={!selectedColumn || !filterValue.trim()}>
              Apply
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowFilterPanel(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Active filters */}
      {filters.length > 0 && (
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-white/50 text-xs'>Active filters:</span>
          {filters.map((filter, i) => (
            <span
              key={i}
              className='inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary text-xs'
            >
              <span className="font-medium">{filter.column}</span>
              <span className="text-white/50">contains</span>
              <span>"{filter.value}"</span>
              <button
                onClick={() => removeFilter(i)}
                className="ml-1 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className='h-6 px-2 text-xs'>
            Clear all
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className='border-white/10 border-b bg-white/5'>
              {tableData.columns.map((col, i) => (
                <th key={i} className="px-4 py-3 text-left font-medium text-white/70">
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={tableData.columns.length} className="px-4 py-8 text-center text-white/50">
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, rowIndex) => (
                <tr key={rowIndex} className='border-white/5 border-b hover:bg-white/5'>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className='max-w-xs truncate px-4 py-3 text-white/80'>
                      {cell === null ? <span className="text-white/30">null</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Collapsible View Controls Toolbar
function ViewControlsToolbar({
  showChart,
  setShowChart,
  showDashboard,
  setShowDashboard,
  isStreaming,
  toggleStreaming,
  analyses,
  isClearing,
  handleClear,
}: {
  showChart: boolean;
  setShowChart: (val: boolean) => void;
  showDashboard: boolean;
  setShowDashboard: (val: boolean) => void;
  isStreaming: boolean;
  toggleStreaming: () => void;
  analyses: NewsAnalysis[];
  isClearing: boolean;
  handleClear: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count active views for badge
  const activeCount = [showChart, showDashboard, isStreaming].filter(Boolean).length;

  return (
    <div className='shrink-0 border-white/10 border-b bg-black/20'>
      {/* Main toolbar row */}
      <div className='flex items-center justify-between px-4 py-3'>
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-white/50" />
          <span className="font-medium text-sm text-white">Sentiment Analysis</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 font-medium text-primary text-xs">
              {activeCount} active
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2 text-white/60 hover:text-white"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">View Options</span>
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Expandable controls row */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className='flex flex-wrap items-center gap-2 border-white/10 border-t bg-black/10 px-4 py-2'>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChart(!showChart)}
                className={`gap-2 ${showChart ? 'border-blue-400/30 bg-blue-400/10 text-blue-400' : ''}`}
              >
                <LineChart className="h-4 w-4" />
                Chart
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDashboard(!showDashboard)}
                className={`gap-2 ${showDashboard ? 'border-primary/30 bg-primary/10 text-primary' : ''}`}
              >
                {showDashboard ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
                Dashboard
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleStreaming}
                className={`gap-2 ${isStreaming ? 'border-green-400/30 bg-green-400/10 text-green-400' : ''}`}
              >
                {isStreaming ? (
                  <>
                    <Radio className="h-4 w-4 animate-pulse" />
                    <span>Live</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Live Feed</span>
                  </>
                )}
              </Button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Clear button - only show when there's data */}
              {analyses.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={isClearing}
                  className='gap-2 text-white/40 hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-400'
                >
                  {isClearing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Clear
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NewsFeed() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analyses, setAnalyses] = useState<NewsAnalysis[]>([]);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [endpointAvailable, setEndpointAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  // Lift tableData state to prevent reloading on tab switch
  const [_deltaTableData, _setDeltaTableData] = useState<TableData | null>(null);
  // Dashboard panel visibility (trader view)
  const [showDashboard, setShowDashboard] = useState(true);
  // Streaming news simulation
  const [isStreaming, setIsStreaming] = useState(false);
  const [_streamIndex, setStreamIndex] = useState(0);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Live headlines from RSS (real news when available, fallback to static)
  const [liveHeadlines, setLiveHeadlines] = useState<string[]>(FALLBACK_HEADLINES);
  // TradingView chart visibility (lazy loaded on demand)
  const [showChart, setShowChart] = useState(false);
  const [, startTransition] = useTransition();

  // Panel state - must be called before any conditional returns (Rules of Hooks)
  const { chatPanelOpen, geniePanelOpen } = useActiveTab();

  const _deltaTableName = 'ananyaroy.agents.news_sentiment_workflow_agent_payload';

  // Fetch real headlines from RSS on mount
  useEffect(() => {
    fetch('/api/news/headlines')
      .then(res => res.json())
      .then(data => {
        if (data.headlines && data.headlines.length > 0) {
          const real = data.headlines.map((h: { headline: string }) => h.headline);
          console.log(`[NewsFeed] Loaded ${real.length} real headlines from ${data.source}`);
          setLiveHeadlines(real);
        }
      })
      .catch(() => {
        console.log('[NewsFeed] RSS unavailable, using fallback headlines');
      });
  }, []);

  // Check if sentiment endpoint is configured
  useEffect(() => {
    fetch('/api/sentiment/config')
      .then(res => res.json())
      .then(data => setEndpointAvailable(data.available))
      .catch(() => setEndpointAvailable(false));
  }, []);

  // Load history from database on mount
  useEffect(() => {
    if (endpointAvailable && !historyLoaded) {
      fetchHistory()
        .then(history => {
          setAnalyses(history);
          setHistoryLoaded(true);
        })
        .catch(err => {
          console.error('Failed to load history:', err);
          setHistoryLoaded(true);
        });
    }
  }, [endpointAvailable, historyLoaded]);

  // Streaming news - analyze one headline every 15 seconds
  const analyzeStreamedHeadline = useCallback(async (headline: string) => {
    const tempId = `stream-${Date.now()}`;
    const pendingAnalysis: NewsAnalysis = {
      id: tempId,
      headline,
      company: '',
      status: 'neutral',
      confidence: '',
      confidencePercent: 0,
      sentimentScore: 0,
      rationale: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    };

    setAnalyses(prev => [pendingAnalysis, ...prev]);

    try {
      const result = await analyzeNews(tempId, headline);
      setAnalyses(prev => prev.map(a => a.id === tempId ? result : a));
    } catch (err) {
      console.error('Stream analysis error:', err);
      setAnalyses(prev => prev.filter(a => a.id !== tempId));
    }
  }, []);

  useEffect(() => {
    if (isStreaming && endpointAvailable) {
      streamIntervalRef.current = setInterval(() => {
        setStreamIndex(prev => {
          const nextIndex = prev >= liveHeadlines.length - 1 ? 0 : prev + 1;
          analyzeStreamedHeadline(liveHeadlines[nextIndex]);
          return nextIndex;
        });
      }, 15000); // Every 15 seconds
    } else {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
    }

    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, [isStreaming, endpointAvailable, analyzeStreamedHeadline, liveHeadlines]);

  const toggleStreaming = () => {
    setIsStreaming(prev => !prev);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const headlineText = input.trim();
    const tempId = `temp-${Date.now()}`;

    // Optimistic UI: immediately show pending item and clear input
    const pendingAnalysis: NewsAnalysis = {
      id: tempId,
      headline: headlineText,
      company: '',
      status: 'neutral',
      confidence: '',
      confidencePercent: 0,
      sentimentScore: 0,
      rationale: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    };

    setAnalyses(prev => [pendingAnalysis, ...prev]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzeNews(tempId, headlineText);
      // Replace pending item with actual result
      setAnalyses(prev => prev.map(a => a.id === tempId ? result : a));
    } catch (err) {
      console.error('Error analyzing news:', err);
      setError('Failed to analyze headline. Please try again.');
      // Remove the pending item on error
      setAnalyses(prev => prev.filter(a => a.id !== tempId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (isClearing) return;
    setIsClearing(true);
    try {
      await clearHistory();
      setAnalyses([]);
      setError(null);
    } catch (err) {
      console.error('Failed to clear history:', err);
      setError('Failed to clear history. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  // Show loading state while checking endpoint availability
  if (endpointAvailable === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-white/60">Checking endpoint availability...</p>
      </div>
    );
  }

  // Show unavailable message if endpoint is not configured
  if (!endpointAvailable) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
          <ServerOff className="h-8 w-8 text-yellow-500" />
        </div>
        <h2 className='mb-2 font-semibold text-white text-xl'>Sentiment Endpoint Not Configured</h2>
        <p className="max-w-md text-center text-white/60">
          The sentiment analysis endpoint is not configured. Please ensure the
          DATABRICKS_SENTIMENT_ENDPOINT environment variable is set in your deployment.
        </p>
      </div>
    );
  }

  const bothPanelsOpen = chatPanelOpen && geniePanelOpen;
  // Use side-by-side layout only when dashboard is shown AND there's enough room
  const useTwoColumns = showDashboard && !bothPanelsOpen;

  // Compute metrics for PDF export
  const completedForExport = analyses.filter(a => !a.isLoading);
  const exportMetrics = {
    total: completedForExport.length,
    bullishCount: completedForExport.filter(a => a.status === 'bullish').length,
    bearishCount: completedForExport.filter(a => a.status === 'bearish').length,
    neutralCount: completedForExport.filter(a => a.status === 'neutral').length,
    bullishPercent: completedForExport.length > 0 ? Math.round((completedForExport.filter(a => a.status === 'bullish').length / completedForExport.length) * 100) : 0,
    bearishPercent: completedForExport.length > 0 ? Math.round((completedForExport.filter(a => a.status === 'bearish').length / completedForExport.length) * 100) : 0,
    avgConfidence: completedForExport.length > 0 ? Math.round(completedForExport.reduce((acc, a) => acc + a.confidencePercent, 0) / completedForExport.length) : 0,
    avgSentiment: completedForExport.length > 0 ? Math.round(completedForExport.reduce((acc, a) => acc + a.sentimentScore, 0) / completedForExport.length * 100) / 100 : 0.5,
  };

  // Display limited analyses with "Show More" capability
  const displayedAnalyses = analyses.slice(0, displayLimit);
  const hasMoreAnalyses = analyses.length > displayLimit;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Market Indices Header - Stock Ticker Banner */}
      <MarketIndicesHeader />
      <SectorImpactBanner />

      {/* Hidden data bridge for PDF export */}
      <div
        className="sentiment-data hidden"
        data-analyses={JSON.stringify(completedForExport.map(a => ({
          headline: a.headline,
          company: a.company,
          status: a.status,
          confidence: a.confidence,
          confidencePercent: a.confidencePercent,
          sentimentScore: a.sentimentScore,
          rationale: a.rationale,
          timestamp: a.timestamp,
        })))}
        data-metrics={JSON.stringify(exportMetrics)}
      />

      {/* Header with collapsible view controls */}
      <ViewControlsToolbar
        showChart={showChart}
        setShowChart={(val) => startTransition(() => setShowChart(val))}
        showDashboard={showDashboard}
        setShowDashboard={setShowDashboard}
        isStreaming={isStreaming}
        toggleStreaming={toggleStreaming}
        analyses={analyses}
        isClearing={isClearing}
        handleClear={handleClear}
      />

      {/* TradingView Chart - Lazy loaded on demand with smooth animation */}
      <AnimatePresence>
        {showChart && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="shrink-0 overflow-hidden border-white/10 border-b bg-black/30"
          >
            <div className="p-4">
              <Suspense
                fallback={
                  <div className="flex h-[400px] items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className='text-sm text-white/60'>Loading TradingView Chart...</span>
                    </div>
                  </div>
                }
              >
                <TradingViewSearchableChart symbol="NASDAQ:AAPL" height={400} />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {useTwoColumns ? (
          /* Two-column: side-by-side with independent scroll */
          <div className="grid h-full grid-cols-2">
            {/* Left Panel - Sentiment Analysis Cards */}
            <div className='h-full overflow-y-auto border-white/10 border-r p-4'>
              <div className="mx-auto max-w-2xl space-y-4">
                {error && (
                  <div
                    className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400"
                  >
                    {error}
                  </div>
                )}

                {analyses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <TrendingUp className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className='mb-2 font-semibold text-white text-xl'>I will help you to make more informed investment decisions. What do you want to know?</h2>
                    <p className="max-w-md text-white/60">
                      Enter a news headline below to get AI-powered sentiment analysis
                      with company identification, status, confidence, and sentiment scores.
                    </p>
                  </div>
                ) : (
                  <>
                    {displayedAnalyses.map((analysis) => (
                      <NewsCard key={analysis.id} analysis={analysis} />
                    ))}
                    {hasMoreAnalyses && (
                      <Button
                        variant="outline"
                        className="w-full border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
                        onClick={() => setDisplayLimit(prev => prev + 10)}
                      >
                        <ChevronDown className="mr-2 h-4 w-4" />
                        Show More ({analyses.length - displayLimit} remaining)
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right Panel - Dashboard */}
            <div className="h-full overflow-y-auto bg-black/20 p-4">
              <SentimentDashboard analyses={analyses} />
            </div>
          </div>
        ) : (
          /* Single column: everything stacks and scrolls together */
          <div className="space-y-4 p-4">
            <div className="mx-auto max-w-4xl space-y-4">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
                  {error}
                </div>
              )}

              {analyses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <TrendingUp className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className='mb-2 font-semibold text-white text-xl'>I will help you to make more informed investment decisions. What do you want to know?</h2>
                  <p className="max-w-md text-white/60">
                    Enter a news headline below to get AI-powered sentiment analysis
                    with company identification, status, confidence, and sentiment scores.
                  </p>
                </div>
              ) : (
                <>
                  {displayedAnalyses.map((analysis) => (
                    <NewsCard key={analysis.id} analysis={analysis} />
                  ))}
                  {hasMoreAnalyses && (
                    <Button
                      variant="outline"
                      className="w-full border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
                      onClick={() => setDisplayLimit(prev => prev + 10)}
                    >
                      <ChevronDown className="mr-2 h-4 w-4" />
                      Show More ({analyses.length - displayLimit} remaining)
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Dashboard below cards when stacked */}
            {showDashboard && (
              <div className="mx-auto max-w-4xl">
                <SentimentDashboard analyses={analyses} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className='shrink-0 border-white/10 border-t bg-black/20 p-4'>
        <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a news headline to analyze..."
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="gap-2 bg-primary px-6 hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Analyze
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
