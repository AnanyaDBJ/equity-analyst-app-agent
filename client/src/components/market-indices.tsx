import { useState, useEffect, memo, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity, Clock, RefreshCw } from 'lucide-react';

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  isLoading?: boolean;
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
  volume?: number;
  timestamp?: number;
}

// Check if US market is open (9:30 AM - 4:00 PM ET, Mon-Fri)
const isMarketOpen = (): { isOpen: boolean; status: string; nextEvent: string } => {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etTime.getDay();
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  // Weekend
  if (day === 0 || day === 6) {
    return { isOpen: false, status: 'Closed', nextEvent: 'Opens Monday 9:30 AM ET' };
  }

  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  if (currentMinutes < marketOpen) {
    return { isOpen: false, status: 'Pre-Market', nextEvent: 'Opens 9:30 AM ET' };
  }

  if (currentMinutes >= marketClose) {
    return { isOpen: false, status: 'After-Hours', nextEvent: 'Opens tomorrow 9:30 AM ET' };
  }

  const minutesLeft = marketClose - currentMinutes;
  const hoursLeft = Math.floor(minutesLeft / 60);
  const minsLeft = minutesLeft % 60;

  return {
    isOpen: true,
    status: 'Market Open',
    nextEvent: `Closes in ${hoursLeft}h ${minsLeft}m`,
  };
};

// STABLE demo data for indices (used when API is not configured)
// Values are fixed to prevent flickering - only changes on manual refresh
const STATIC_DEMO_INDICES: MarketIndex[] = [
  { symbol: 'SPX', name: 'S&P 500', price: 5234.18, change: 23.45, changePercent: 0.45 },
  { symbol: 'NDX', name: 'NASDAQ', price: 18439.17, change: 87.32, changePercent: 0.48 },
  { symbol: 'DJI', name: 'DOW', price: 39127.80, change: -45.12, changePercent: -0.12 },
  { symbol: 'VIX', name: 'VIX', price: 13.25, change: -0.32, changePercent: -2.36 },
];

// Generate new random demo values (only called on manual refresh)
const generateNewDemoIndices = (): MarketIndex[] => {
  const baseData = [
    { symbol: 'SPX', name: 'S&P 500', basePrice: 5234.18 },
    { symbol: 'NDX', name: 'NASDAQ', basePrice: 18439.17 },
    { symbol: 'DJI', name: 'DOW', basePrice: 39127.80 },
    { symbol: 'VIX', name: 'VIX', basePrice: 13.25 },
  ];

  return baseData.map(({ symbol, name, basePrice }) => {
    const changePercent = (Math.random() - 0.45) * 2;
    const change = basePrice * (changePercent / 100);
    return {
      symbol,
      name,
      price: basePrice + change,
      change,
      changePercent,
    };
  });
};

// Hook to fetch stock quotes from server API (which proxies to Finnhub)
export const useStockQuotes = (
  symbols: string[]
): {
  quotes: Map<string, StockQuote>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  isConfigured: boolean;
} => {
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // Check if stock API is configured
  useEffect(() => {
    fetch('/api/stocks/config')
      .then(res => res.json())
      .then(data => setIsConfigured(data.available))
      .catch(() => setIsConfigured(false));
  }, []);

  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stocks/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      });

      if (!response.ok) {
        if (response.status === 503) {
          // API not configured - use demo data
          setIsConfigured(false);
          return;
        }
        throw new Error('Failed to fetch quotes');
      }

      const data = await response.json();
      const newQuotes = new Map<string, StockQuote>();

      (data.quotes || []).forEach((quote: StockQuote) => {
        if (quote.price) {
          newQuotes.set(quote.symbol, quote);
        }
      });

      setQuotes(newQuotes);
      setIsConfigured(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quotes');
    } finally {
      setIsLoading(false);
    }
  }, [symbols]);

  // No automatic polling - quotes are only fetched on manual refresh

  return { quotes, isLoading, error, refetch: fetchQuotes, isConfigured };
};

// Market Status Badge Component
export const MarketStatusBadge = memo(function MarketStatusBadge() {
  const [marketInfo, setMarketInfo] = useState(isMarketOpen());

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketInfo(isMarketOpen());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-xs ${
          marketInfo.isOpen
            ? 'border border-green-500/30 bg-green-500/20 text-green-400'
            : 'border border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            marketInfo.isOpen ? 'animate-pulse bg-green-400' : 'bg-yellow-400'
          }`}
        />
        {marketInfo.status}
      </div>
      <span className='hidden text-white/40 text-xs sm:inline'>{marketInfo.nextEvent}</span>
    </div>
  );
});

// Single Index Card Component - with CSS transitions for smooth updates
const IndexCard = memo(function IndexCard({ index }: { index: MarketIndex }) {
  const isPositive = index.change >= 0;

  return (
    <div className='flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition-all duration-300'>
      <div className="min-w-[60px]">
        <div className='text-white/50 text-xs'>{index.name}</div>
        <div className='font-semibold text-sm text-white transition-all duration-300'>
          {index.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      </div>
      <div
        className={`flex items-center gap-1 font-medium text-xs transition-colors duration-300 ${
          isPositive ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        <span>
          {isPositive ? '+' : ''}
          {index.changePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
});

// Stable symbols array - defined outside component to prevent re-render loops
const MARKET_SYMBOLS = ['AAPL', 'GOOGL', 'MSFT', 'NVDA'];

// Main Market Indices Header Component
export const MarketIndicesHeader = memo(function MarketIndicesHeader() {
  // Initialize with stable static data to prevent flickering
  const [indices, setIndices] = useState<MarketIndex[]>(STATIC_DEMO_INDICES);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [hasInitialized, setHasInitialized] = useState(false);

  // Use server API for real data (API key is stored on server)
  // Stable array reference to avoid re-render loops
  const { quotes, isLoading, refetch, isConfigured } = useStockQuotes(MARKET_SYMBOLS);

  useEffect(() => {
    if (isConfigured && quotes.size > 0) {
      // Convert stock quotes to market index format
      const stockIndices: MarketIndex[] = Array.from(quotes.values()).map((q) => ({
        symbol: q.symbol,
        name: q.symbol,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
      }));
      setIndices(stockIndices);
      setLastUpdate(new Date());
      setHasInitialized(true);
    } else if (!hasInitialized) {
      // Use STATIC demo data on first load (no random values to prevent flicker)
      setIndices(STATIC_DEMO_INDICES);
      setHasInitialized(true);
    }
  }, [isConfigured, quotes, hasInitialized]);

  // Manual refresh handler - only place where random demo data is generated
  const handleManualRefresh = useCallback(() => {
    if (isConfigured) {
      refetch();
    } else {
      // Only generate new random values on explicit user action
      setIndices(generateNewDemoIndices());
      setLastUpdate(new Date());
    }
  }, [isConfigured, refetch]);

  // NO automatic refresh for demo data - prevents flickering

  return (
    <div className='border-white/10 border-b bg-black/40 backdrop-blur-sm'>
      <div className="flex items-center justify-between gap-4 px-4 py-2">
        {/* Left: Market Status */}
        <div className="flex items-center gap-4">
          <MarketStatusBadge />
          <div className='hidden items-center gap-1 text-white/40 text-xs md:flex'>
            <Clock className="h-3 w-3" />
            <span>Updated {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Center: Index Cards */}
        <div className='scrollbar-hide flex items-center gap-2 overflow-x-auto'>
          {isLoading && indices.length === 0 ? (
            <div className='flex items-center gap-2 text-sm text-white/50'>
              <Activity className="h-4 w-4 animate-pulse" />
              Loading...
            </div>
          ) : (
            indices.slice(0, 4).map((index) => <IndexCard key={index.symbol} index={index} />)
          )}
        </div>

        {/* Right: Refresh Button */}
        <button
          onClick={handleManualRefresh}
          className='rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white'
          title="Refresh data"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
});

// Compact stock quote display for dashboard
export const StockQuoteCard = memo(function StockQuoteCard({
  symbol,
  name,
  price,
  change,
  changePercent,
  showChart = false,
}: StockQuote & { showChart?: boolean }) {
  const isPositive = change >= 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className='mb-2 flex items-start justify-between'>
        <div>
          <div className="font-semibold text-white">{symbol}</div>
          <div className='max-w-[120px] truncate text-white/50 text-xs'>{name}</div>
        </div>
        <div
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${
            isPositive
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? '+' : ''}{changePercent?.toFixed(2)}%
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div className="font-bold text-2xl text-white">
          ${price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{change?.toFixed(2)}
        </div>
      </div>
      {showChart && (
        <div className='mt-3 flex h-12 items-center justify-center rounded-lg bg-white/5 text-white/30 text-xs'>
          Mini chart placeholder
        </div>
      )}
    </div>
  );
});

export default MarketIndicesHeader;
