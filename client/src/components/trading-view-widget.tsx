import { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  symbol?: string;
  theme?: 'dark' | 'light';
  height?: number;
  showToolbar?: boolean;
}

// Mini chart widget for compact displays
export const TradingViewMiniChart = memo(function TradingViewMiniChart({
  symbol = 'AAPL',
  height = 220,
}: {
  symbol?: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing content
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol,
      width: '100%',
      height: height,
      locale: 'en',
      dateRange: '1D',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: false,
      largeChartUrl: '',
      noTimeScale: false,
      chartOnly: false,
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, height]);

  return (
    <div className='tradingview-widget-container overflow-hidden rounded-lg'>
      <div ref={containerRef} />
    </div>
  );
});

// Full advanced chart widget
export const TradingViewAdvancedChart = memo(function TradingViewAdvancedChart({
  symbol = 'NASDAQ:AAPL',
  theme = 'dark',
  height = 400,
  showToolbar = false,
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: theme,
      style: '1',
      locale: 'en',
      hide_top_toolbar: !showToolbar,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      gridColor: 'rgba(255, 255, 255, 0.06)',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, theme, showToolbar]);

  return (
    <div
      className="tradingview-widget-container overflow-hidden rounded-xl border border-white/10"
      style={{ height }}
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
});

// Ticker tape widget for scrolling stock prices
export const TradingViewTickerTape = memo(function TradingViewTickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
        { proName: 'FOREXCOM:NSXUSD', title: 'US 100' },
        { proName: 'NASDAQ:AAPL', title: 'Apple' },
        { proName: 'NASDAQ:GOOGL', title: 'Google' },
        { proName: 'NASDAQ:MSFT', title: 'Microsoft' },
        { proName: 'NASDAQ:AMZN', title: 'Amazon' },
        { proName: 'NASDAQ:NVDA', title: 'NVIDIA' },
        { proName: 'NASDAQ:META', title: 'Meta' },
        { proName: 'NASDAQ:TSLA', title: 'Tesla' },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: 'adaptive',
      colorTheme: 'dark',
      locale: 'en',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="tradingview-widget-container">
      <div ref={containerRef} />
    </div>
  );
});

// Symbol overview widget - shows price, change, and mini chart
export const TradingViewSymbolOverview = memo(function TradingViewSymbolOverview({
  symbols = ['NASDAQ:AAPL|1D', 'NASDAQ:GOOGL|1D', 'NASDAQ:MSFT|1D'],
  height = 400,
}: {
  symbols?: string[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: symbols.map(s => [s]),
      chartOnly: false,
      width: '100%',
      height: height,
      locale: 'en',
      colorTheme: 'dark',
      autosize: false,
      showVolume: false,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
      scalePosition: 'right',
      scaleMode: 'Normal',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      fontSize: '10',
      noTimeScale: false,
      valuesTracking: '1',
      changeMode: 'price-and-percent',
      chartType: 'area',
      maLineColor: '#2962FF',
      maLineWidth: 1,
      maLength: 9,
      backgroundColor: 'rgba(0, 0, 0, 0)',
      lineWidth: 2,
      lineType: 0,
      dateRanges: ['1d|1', '1m|30', '3m|60', '12m|1D', '60m|1W', 'all|1M'],
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbols, height]);

  return (
    <div
      className="tradingview-widget-container overflow-hidden rounded-xl border border-white/10"
      style={{ height }}
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
});

// Market overview widget showing multiple indices
export const TradingViewMarketOverview = memo(function TradingViewMarketOverview({
  height = 400,
}: {
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      dateRange: '1D',
      showChart: true,
      locale: 'en',
      largeChartUrl: '',
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      width: '100%',
      height: height,
      plotLineColorGrowing: 'rgba(34, 197, 94, 1)',
      plotLineColorFalling: 'rgba(239, 68, 68, 1)',
      gridLineColor: 'rgba(255, 255, 255, 0.06)',
      scaleFontColor: 'rgba(255, 255, 255, 0.6)',
      belowLineFillColorGrowing: 'rgba(34, 197, 94, 0.12)',
      belowLineFillColorFalling: 'rgba(239, 68, 68, 0.12)',
      belowLineFillColorGrowingBottom: 'rgba(34, 197, 94, 0)',
      belowLineFillColorFallingBottom: 'rgba(239, 68, 68, 0)',
      symbolActiveColor: 'rgba(34, 197, 94, 0.12)',
      tabs: [
        {
          title: 'Indices',
          symbols: [
            { s: 'FOREXCOM:SPXUSD', d: 'S&P 500' },
            { s: 'FOREXCOM:NSXUSD', d: 'US 100' },
            { s: 'FOREXCOM:DJI', d: 'Dow 30' },
          ],
          originalTitle: 'Indices',
        },
        {
          title: 'Tech',
          symbols: [
            { s: 'NASDAQ:AAPL', d: 'Apple' },
            { s: 'NASDAQ:GOOGL', d: 'Google' },
            { s: 'NASDAQ:MSFT', d: 'Microsoft' },
            { s: 'NASDAQ:NVDA', d: 'NVIDIA' },
            { s: 'NASDAQ:META', d: 'Meta' },
          ],
          originalTitle: 'Tech',
        },
      ],
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [height]);

  return (
    <div
      className="tradingview-widget-container overflow-hidden rounded-xl border border-white/10"
      style={{ height }}
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
});

// Hotlists widget - shows top gainers, losers, most active stocks
export const TradingViewHotlists = memo(function TradingViewHotlists({
  height = 450,
}: {
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      dateRange: '12M',
      exchange: 'US',
      showChart: true,
      locale: 'en',
      largeChartUrl: '',
      isTransparent: false,
      showSymbolLogo: true,
      showFloatingTooltip: true,
      width: '100%',
      height: height,
      plotLineColorGrowing: 'rgba(34, 197, 94, 1)',
      plotLineColorFalling: 'rgba(239, 68, 68, 1)',
      gridLineColor: 'rgba(255, 255, 255, 0.06)',
      scaleFontColor: 'rgba(255, 255, 255, 0.6)',
      belowLineFillColorGrowing: 'rgba(34, 197, 94, 0.12)',
      belowLineFillColorFalling: 'rgba(239, 68, 68, 0.12)',
      belowLineFillColorGrowingBottom: 'rgba(34, 197, 94, 0)',
      belowLineFillColorFallingBottom: 'rgba(239, 68, 68, 0)',
      symbolActiveColor: 'rgba(34, 197, 94, 0.12)',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [height]);

  return (
    <div className="tradingview-widget-container overflow-hidden rounded-lg" style={{ height }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
});

// Stock search + chart: advanced chart with full toolbar and symbol search
export const TradingViewSearchableChart = memo(function TradingViewSearchableChart({
  symbol = 'NASDAQ:AAPL',
  height = 450,
}: {
  symbol?: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Prevent re-initialization if already loaded with same symbol
    if (scriptLoadedRef.current) return;

    containerRef.current.innerHTML = '';

    // Defer script injection to avoid blocking the main thread during render
    const timeoutId = requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = JSON.stringify({
        autosize: true,
        symbol: symbol,
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        hide_top_toolbar: false,
        hide_legend: false,
        allow_symbol_change: true,
        save_image: false,
        calendar: false,
        hide_volume: false,
        support_host: 'https://www.tradingview.com',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        gridColor: 'rgba(255, 255, 255, 0.06)',
        withdateranges: true,
        details: false,
        hotlist: false,
        show_popup_button: false,
      });

      containerRef.current.appendChild(script);
      scriptLoadedRef.current = true;
    });

    return () => {
      cancelAnimationFrame(timeoutId);
      scriptLoadedRef.current = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, height]);

  return (
    <div className="tradingview-widget-container overflow-hidden rounded-lg" style={{ height }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
});

// Screener widget - full stock screener with search, filters, and columns
export const TradingViewScreener = memo(function TradingViewScreener({
  height = 450,
}: {
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: '100%',
      height: height,
      defaultColumn: 'overview',
      defaultScreen: 'most_capitalized',
      market: 'america',
      showToolbar: true,
      colorTheme: 'dark',
      locale: 'en',
      isTransparent: false,
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [height]);

  return (
    <div className="tradingview-widget-container overflow-hidden rounded-lg" style={{ height }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
});

export default TradingViewAdvancedChart;
