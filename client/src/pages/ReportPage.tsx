import { useState, useEffect, useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
  Printer,
  Download,
  Calendar,
  BarChart3,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Globe,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

interface SectorHeadline {
  id: string;
  headline: string;
  sentimentStatus: string;
  sentimentScore: number;
  impactScore: number;
  relatedSymbols: string[] | null;
  analyzedAt: string;
}

interface SectorData {
  sectorId: string;
  label: string;
  icon: string;
  color: string;
  sentimentScore: number;
  newsCount: number;
  topHeadlines: SectorHeadline[];
}

// ─── Dummy / Fallback Data ────────────────────────────────────────────────────

const DUMMY_ANALYSES: NewsAnalysis[] = [
  {
    id: '1', headline: 'Apple Stock Rises 4.2% as iPhone 17 Launch Exceeds Analyst Expectations',
    company: 'AAPL', status: 'bullish', confidence: 'high', confidencePercent: 92,
    sentimentScore: 0.88, rationale: 'Strong iPhone 17 pre-orders signal robust consumer demand. Supply chain data confirms Apple secured 30% more components vs last year, suggesting confidence in sustained sales volume.',
    timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
  },
  {
    id: '2', headline: 'NVIDIA Reports Record Q4 Revenue of $39.3B, Data Center Growth Accelerates',
    company: 'NVDA', status: 'bullish', confidence: 'high', confidencePercent: 95,
    sentimentScore: 0.93, rationale: 'Revenue beat consensus by 12%. Data center segment grew 93% YoY driven by Blackwell GPU demand. Forward guidance of $43B for Q1 suggests continued AI infrastructure spending.',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: '3', headline: 'Tesla Shares Drop 6% After Missing Q1 Delivery Estimates by Wide Margin',
    company: 'TSLA', status: 'bearish', confidence: 'high', confidencePercent: 88,
    sentimentScore: 0.15, rationale: 'Q1 deliveries of 387K missed consensus of 450K. Production issues at Berlin Gigafactory and growing competition from Chinese EVs weigh heavily on near-term outlook.',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
  {
    id: '4', headline: 'JPMorgan Chase Posts Record Net Income of $14.6B in Q4, Raises Dividend 8%',
    company: 'JPM', status: 'bullish', confidence: 'high', confidencePercent: 90,
    sentimentScore: 0.85, rationale: 'EPS of $4.81 beat estimate of $4.11. NII of $24.2B driven by higher rates. Investment banking fees up 37%. Dividend raise signals management confidence in capital position.',
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: '5', headline: 'Microsoft Azure Revenue Grows 33% YoY, AI Services Drive Cloud Acceleration',
    company: 'MSFT', status: 'bullish', confidence: 'high', confidencePercent: 91,
    sentimentScore: 0.87, rationale: 'Azure growth re-accelerated from 29% last quarter. AI services contributed 12 points of growth. Copilot enterprise adoption reached 85K organizations, up from 60K.',
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: '6', headline: 'Pfizer Cuts Full-Year Revenue Guidance by $2B Citing Slower COVID Product Sales',
    company: 'PFE', status: 'bearish', confidence: 'medium', confidencePercent: 75,
    sentimentScore: 0.22, rationale: 'COVID franchise decline faster than expected. Paxlovid demand weakening. Pipeline progress on oncology assets positive but insufficient to offset near-term revenue headwinds.',
    timestamp: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: '7', headline: 'Amazon Web Services Expands AI Chip Partnership, Stock Gains 3.1% in After-Hours',
    company: 'AMZN', status: 'bullish', confidence: 'medium', confidencePercent: 78,
    sentimentScore: 0.76, rationale: 'Custom Trainium chips reduce AI inference costs by 40%. AWS market share stabilized at 31%. E-commerce margins expanding as fulfillment network optimization bears fruit.',
    timestamp: new Date(Date.now() - 7 * 3600000).toISOString(),
  },
  {
    id: '8', headline: 'ExxonMobil Announces $60B Pioneer Acquisition Completion, Boosting Permian Output',
    company: 'XOM', status: 'bullish', confidence: 'medium', confidencePercent: 72,
    sentimentScore: 0.68, rationale: 'Pioneer integration on track. Permian Basin production capacity increases to 1.3M boe/d. Synergy realization ahead of $2B annual target. Brent at $78 supports strong cash generation.',
    timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: '9', headline: 'Intel Warns of Restructuring Costs as Foundry Business Faces $7B Annual Loss',
    company: 'INTC', status: 'bearish', confidence: 'high', confidencePercent: 85,
    sentimentScore: 0.12, rationale: 'Foundry losses exceed expectations. Process technology behind TSMC by 1-2 nodes. Management announced 15K layoffs and CapEx reduction. Dividend previously suspended remains paused.',
    timestamp: new Date(Date.now() - 9 * 3600000).toISOString(),
  },
  {
    id: '10', headline: 'Goldman Sachs Reports Strong Trading Revenue, Investment Banking Pipeline Robust',
    company: 'GS', status: 'bullish', confidence: 'medium', confidencePercent: 77,
    sentimentScore: 0.74, rationale: 'FICC trading revenue up 22% on volatility. Equities revenue strong. M&A advisory backlog at multi-year high suggests fee revenue acceleration in coming quarters.',
    timestamp: new Date(Date.now() - 10 * 3600000).toISOString(),
  },
];

const DUMMY_SECTORS: SectorData[] = [
  {
    sectorId: 'technology', label: 'Technology', icon: 'Monitor', color: '#3b82f6',
    sentimentScore: 0.74, newsCount: 28,
    topHeadlines: [
      { id: 's1', headline: 'NVIDIA Reports Record Q4 Revenue of $39.3B', sentimentStatus: 'bullish', sentimentScore: 0.93, impactScore: 0.88, relatedSymbols: ['NVDA'], analyzedAt: new Date().toISOString() },
      { id: 's2', headline: 'Apple Stock Rises 4.2% as iPhone 17 Launch Exceeds Expectations', sentimentStatus: 'bullish', sentimentScore: 0.88, impactScore: 0.81, relatedSymbols: ['AAPL'], analyzedAt: new Date().toISOString() },
    ],
  },
  {
    sectorId: 'financials', label: 'Financials', icon: 'DollarSign', color: '#8b5cf6',
    sentimentScore: 0.71, newsCount: 19,
    topHeadlines: [
      { id: 's3', headline: 'JPMorgan Posts Record Net Income of $14.6B', sentimentStatus: 'bullish', sentimentScore: 0.85, impactScore: 0.76, relatedSymbols: ['JPM'], analyzedAt: new Date().toISOString() },
      { id: 's4', headline: 'Goldman Sachs Reports Strong Trading Revenue', sentimentStatus: 'bullish', sentimentScore: 0.74, impactScore: 0.57, relatedSymbols: ['GS'], analyzedAt: new Date().toISOString() },
    ],
  },
  {
    sectorId: 'healthcare', label: 'Healthcare', icon: 'Heart', color: '#22c55e',
    sentimentScore: 0.45, newsCount: 14,
    topHeadlines: [
      { id: 's5', headline: 'Pfizer Cuts Full-Year Revenue Guidance by $2B', sentimentStatus: 'bearish', sentimentScore: 0.22, impactScore: 0.58, relatedSymbols: ['PFE'], analyzedAt: new Date().toISOString() },
      { id: 's6', headline: 'Eli Lilly Weight Loss Drug Sales Top $5B', sentimentStatus: 'bullish', sentimentScore: 0.82, impactScore: 0.72, relatedSymbols: ['LLY'], analyzedAt: new Date().toISOString() },
    ],
  },
  {
    sectorId: 'consumer', label: 'Consumer', icon: 'ShoppingBag', color: '#ec4899',
    sentimentScore: 0.52, newsCount: 16,
    topHeadlines: [
      { id: 's7', headline: 'Tesla Shares Drop 6% After Missing Q1 Delivery Estimates', sentimentStatus: 'bearish', sentimentScore: 0.15, impactScore: 0.75, relatedSymbols: ['TSLA'], analyzedAt: new Date().toISOString() },
      { id: 's8', headline: 'Amazon Web Services Expands AI Chip Partnership', sentimentStatus: 'bullish', sentimentScore: 0.76, impactScore: 0.62, relatedSymbols: ['AMZN'], analyzedAt: new Date().toISOString() },
    ],
  },
  {
    sectorId: 'energy', label: 'Energy', icon: 'Zap', color: '#f59e0b',
    sentimentScore: 0.63, newsCount: 11,
    topHeadlines: [
      { id: 's9', headline: 'ExxonMobil Announces $60B Pioneer Acquisition Completion', sentimentStatus: 'bullish', sentimentScore: 0.68, impactScore: 0.49, relatedSymbols: ['XOM'], analyzedAt: new Date().toISOString() },
    ],
  },
  {
    sectorId: 'industrials', label: 'Industrials', icon: 'Factory', color: '#06b6d4',
    sentimentScore: 0.58, newsCount: 9,
    topHeadlines: [
      { id: 's10', headline: 'Boeing Resumes 737 MAX Deliveries After FAA Review', sentimentStatus: 'neutral', sentimentScore: 0.51, impactScore: 0.45, relatedSymbols: ['BA'], analyzedAt: new Date().toISOString() },
    ],
  },
];

const TREND_DATA = (() => {
  const now = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (13 - i));
    const base = 0.55 + Math.sin(i * 0.5) * 0.12 + (Math.random() - 0.5) * 0.08;
    const vol = Math.floor(6 + Math.random() * 12);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sentiment: Math.round(Math.max(0.2, Math.min(0.9, base)) * 100) / 100,
      volume: vol,
      bullish: Math.floor(vol * base),
      bearish: Math.floor(vol * (1 - base) * 0.6),
      neutral: Math.floor(vol * (1 - base) * 0.4),
    };
  });
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sentimentBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    bullish: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Bullish' },
    bearish: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Bearish' },
    neutral: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Neutral' },
  };
  const s = map[status] || map.neutral;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>
      {status === 'bullish' ? <TrendingUp className="h-3 w-3" /> : status === 'bearish' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {s.label}
    </span>
  );
}

function scoreColor(score: number) {
  if (score >= 0.67) return 'text-emerald-700';
  if (score <= 0.33) return 'text-red-700';
  return 'text-amber-700';
}

function scoreBg(score: number) {
  if (score >= 0.67) return 'bg-emerald-50';
  if (score <= 0.33) return 'bg-red-50';
  return 'bg-amber-50';
}

function confidenceBadge(pct: number) {
  if (pct >= 85) return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><Shield className="h-3 w-3" />High ({pct}%)</span>;
  if (pct >= 65) return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"><AlertTriangle className="h-3 w-3" />Medium ({pct}%)</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500"><Clock className="h-3 w-3" />Low ({pct}%)</span>;
}

const LightTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      {payload.map((e: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: e.color }}>{e.name}: {typeof e.value === 'number' ? e.value.toFixed(2) : e.value}</p>
      ))}
    </div>
  );
};

// ─── Report Page ──────────────────────────────────────────────────────────────

export default function ReportPage() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<NewsAnalysis[]>(DUMMY_ANALYSES);
  const [sectors, setSectors] = useState<SectorData[]>(DUMMY_SECTORS);

  // Fetch live data and merge with dummy fallback
  useEffect(() => {
    (async () => {
      try {
        const [sentRes, sectorRes] = await Promise.allSettled([
          fetch('/api/sentiment/history?limit=50'),
          fetch('/api/sectors/banner'),
        ]);
        if (sentRes.status === 'fulfilled' && sentRes.value.ok) {
          const data = await sentRes.value.json();
          const live: NewsAnalysis[] = (data.analyses || []).map((a: any) => ({
            id: a.id,
            headline: a.headline,
            company: a.company || 'N/A',
            status: a.status,
            confidence: a.confidence,
            confidencePercent: a.confidencePercent,
            sentimentScore: a.sentimentScore,
            rationale: a.rationale || '',
            timestamp: a.createdAt || a.timestamp || new Date().toISOString(),
          }));
          if (live.length > 0) setAnalyses(live);
        }
        if (sectorRes.status === 'fulfilled' && sectorRes.value.ok) {
          const data = await sectorRes.value.json();
          if (data.sectors?.length > 0) setSectors(data.sectors);
        }
      } catch {
        // keep dummy data
      }
    })();
  }, []);

  // ─── Computed metrics ─────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const total = analyses.length;
    const bullish = analyses.filter((a) => a.status === 'bullish').length;
    const bearish = analyses.filter((a) => a.status === 'bearish').length;
    const neutral = total - bullish - bearish;
    const avgSentiment = total > 0 ? analyses.reduce((s, a) => s + a.sentimentScore, 0) / total : 0.5;
    const avgConfidence = total > 0 ? Math.round(analyses.reduce((s, a) => s + a.confidencePercent, 0) / total) : 0;
    const highConfCount = analyses.filter((a) => a.confidencePercent >= 85).length;
    return { total, bullish, bearish, neutral, avgSentiment, avgConfidence, highConfCount };
  }, [analyses]);

  const topMoversBullish = useMemo(() =>
    [...analyses].filter((a) => a.status === 'bullish').sort((a, b) => b.sentimentScore - a.sentimentScore).slice(0, 3),
    [analyses],
  );
  const topMoversBearish = useMemo(() =>
    [...analyses].filter((a) => a.status === 'bearish').sort((a, b) => a.sentimentScore - b.sentimentScore).slice(0, 3),
    [analyses],
  );

  const pieData = [
    { name: 'Bullish', value: metrics.bullish, color: '#16a34a' },
    { name: 'Bearish', value: metrics.bearish, color: '#dc2626' },
    { name: 'Neutral', value: metrics.neutral, color: '#d97706' },
  ];

  const sectorChartData = sectors.map((s) => ({
    sector: s.label,
    sentiment: Math.round(s.sentimentScore * 100),
    articles: s.newsCount,
    color: s.color,
  }));

  const now = new Date();
  const reportDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const reportTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="report-page min-h-screen bg-white text-slate-900">
      {/* Top Action Bar (hidden in print) */}
      <div className="print:hidden sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-8 py-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors">
              <Download className="h-4 w-4" /> Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="mx-auto max-w-[1100px] px-8 py-10 print:px-0 print:py-0">

        {/* ═══════════ COVER HEADER ═══════════ */}
        <header className="mb-10 border-b-2 border-slate-900 pb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Equity Research</p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">Market Sentiment Report</h1>
              <p className="mt-2 text-lg text-slate-500">AI-Powered News Sentiment Analysis</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Calendar className="h-4 w-4" />
                {reportDate}
              </div>
              <p className="mt-1 text-xs text-slate-400">Generated {reportTime}</p>
              <div className="mt-3 flex items-center gap-1.5 justify-end">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-600">Live Data</span>
              </div>
            </div>
          </div>
        </header>

        {/* ═══════════ EXECUTIVE SUMMARY ═══════════ */}
        <section className="mb-10">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">
            <Activity className="h-5 w-5 text-blue-600" /> Executive Summary
          </h2>

          {/* Overall Market Gauge */}
          <div className={`mb-6 rounded-xl border-2 p-6 ${metrics.avgSentiment >= 0.55 ? 'border-emerald-200 bg-emerald-50/50' : metrics.avgSentiment <= 0.45 ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Overall Market Sentiment</p>
                <div className="flex items-baseline gap-3">
                  <span className={`text-5xl font-bold ${scoreColor(metrics.avgSentiment)}`}>
                    {(metrics.avgSentiment * 100).toFixed(1)}
                  </span>
                  <span className="text-lg text-slate-400">/ 100</span>
                </div>
              </div>
              <div className={`flex items-center gap-2 rounded-xl px-5 py-3 text-lg font-bold ${metrics.avgSentiment >= 0.55 ? 'bg-emerald-100 text-emerald-800' : metrics.avgSentiment <= 0.45 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                {metrics.avgSentiment >= 0.55 ? <TrendingUp className="h-6 w-6" /> : metrics.avgSentiment <= 0.45 ? <TrendingDown className="h-6 w-6" /> : <Minus className="h-6 w-6" />}
                {metrics.avgSentiment >= 0.55 ? 'BULLISH' : metrics.avgSentiment <= 0.45 ? 'BEARISH' : 'NEUTRAL'}
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Based on AI analysis of <strong>{metrics.total} news headlines</strong> across {sectors.length} market sectors,
              overall sentiment is <strong>{metrics.avgSentiment >= 0.55 ? 'positive' : metrics.avgSentiment <= 0.45 ? 'negative' : 'mixed'}</strong> with
              an average confidence level of <strong>{metrics.avgConfidence}%</strong>.
              {metrics.bullish > metrics.bearish
                ? ` Bullish signals outnumber bearish ${metrics.bullish} to ${metrics.bearish}, driven primarily by strong earnings in Technology and Financials.`
                : ` Bearish signals are elevated at ${metrics.bearish} vs ${metrics.bullish} bullish, indicating increased market caution.`}
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Headlines Analyzed', value: metrics.total, sub: 'Last 24 hours', icon: BarChart3, accent: 'text-blue-600 bg-blue-50 border-blue-200' },
              { label: 'Bullish Signals', value: `${metrics.bullish} (${Math.round((metrics.bullish / metrics.total) * 100)}%)`, sub: `${topMoversBullish[0]?.company || 'N/A'} leading`, icon: TrendingUp, accent: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              { label: 'Bearish Signals', value: `${metrics.bearish} (${Math.round((metrics.bearish / metrics.total) * 100)}%)`, sub: `${topMoversBearish[0]?.company || 'N/A'} weakest`, icon: TrendingDown, accent: 'text-red-600 bg-red-50 border-red-200' },
              { label: 'Avg Confidence', value: `${metrics.avgConfidence}%`, sub: `${metrics.highConfCount} high-confidence`, icon: Shield, accent: 'text-violet-600 bg-violet-50 border-violet-200' },
            ].map((kpi) => (
              <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.accent}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{kpi.label}</p>
                  <kpi.icon className="h-4 w-4 opacity-60" />
                </div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="mt-1 text-xs text-slate-500">{kpi.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ SENTIMENT TREND ═══════════ */}
        <section className="mb-10">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">
            <BarChart3 className="h-5 w-5 text-blue-600" /> 14-Day Sentiment Trend
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {/* Area Chart */}
            <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={TREND_DATA}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis domain={[0.2, 0.9]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => `${(v * 100).toFixed(0)}`} />
                    <Tooltip content={<LightTooltip />} />
                    <Area type="monotone" dataKey="sentiment" stroke="#3b82f6" strokeWidth={2.5} fill="url(#trendFill)" name="Sentiment" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-center text-xs text-slate-400">Score normalized 0-100. Above 55 = bullish bias, below 45 = bearish bias.</p>
            </div>

            {/* Pie Chart */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Sentiment Distribution</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<LightTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex justify-center gap-4">
                {pieData.map((e) => (
                  <div key={e.name} className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                    <span className="text-xs text-slate-500">{e.name} ({e.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ SECTOR ANALYSIS ═══════════ */}
        <section className="mb-10 break-before-page">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">
            <Globe className="h-5 w-5 text-blue-600" /> Sector-Wise Analysis
          </h2>

          {/* Sector Bar Chart */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="sector" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} label={{ value: 'Sentiment Score', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: 11 } }} />
                  <Tooltip content={<LightTooltip />} />
                  <Legend />
                  <Bar dataKey="sentiment" name="Sentiment Score" radius={[4, 4, 0, 0]}>
                    {sectorChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                  <Bar dataKey="articles" name="Articles Analyzed" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sector Detail Cards */}
          <div className="grid grid-cols-2 gap-4">
            {sectors.map((sector) => {
              const score = Math.round(sector.sentimentScore * 100);
              const status = score >= 55 ? 'bullish' : score <= 45 ? 'bearish' : 'neutral';
              return (
                <div key={sector.sectorId} className="rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${sector.color}15` }}>
                        <span className="text-sm font-bold" style={{ color: sector.color }}>{sector.label.charAt(0)}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{sector.label}</h3>
                        <p className="text-xs text-slate-400">{sector.newsCount} articles analyzed</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${scoreColor(sector.sentimentScore)}`}>{score}</p>
                      {sentimentBadge(status)}
                    </div>
                  </div>
                  {/* Sentiment bar */}
                  <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: sector.color }} />
                  </div>
                  {/* Top headlines */}
                  {sector.topHeadlines.slice(0, 2).map((h) => (
                    <div key={h.id} className="mb-1.5 flex items-start gap-2 text-xs">
                      {h.sentimentStatus === 'bullish' ? <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" /> : h.sentimentStatus === 'bearish' ? <TrendingDown className="mt-0.5 h-3 w-3 shrink-0 text-red-500" /> : <Minus className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />}
                      <span className="text-slate-600 leading-snug">{h.headline}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══════════ TOP 10 NEWS ANALYSIS ═══════════ */}
        <section className="mb-10 break-before-page">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" /> Top 10 News &mdash; Detailed Sentiment Analysis
          </h2>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">#</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Headline</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Ticker</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Signal</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Score</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {analyses.slice(0, 10).map((a, i) => (
                  <tr key={a.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="px-4 py-3 font-medium text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 max-w-md">
                      <p className="font-medium text-slate-800 leading-snug">{a.headline}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{a.company}</span>
                    </td>
                    <td className="px-4 py-3">{sentimentBadge(a.status)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-bold ${scoreBg(a.sentimentScore)} ${scoreColor(a.sentimentScore)}`}>
                        {(a.sentimentScore * 100).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{confidenceBadge(a.confidencePercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed Rationale Cards */}
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Analyst Rationale</h3>
            {analyses.slice(0, 10).map((a, i) => (
              <div key={a.id} className="flex gap-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">{i + 1}</div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{a.company}</span>
                    {sentimentBadge(a.status)}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">{a.rationale}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ TOP MOVERS ═══════════ */}
        <section className="mb-10">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">
            <TrendingUp className="h-5 w-5 text-blue-600" /> Key Movers &amp; Watchlist
          </h2>
          <div className="grid grid-cols-2 gap-6">
            {/* Top Bullish */}
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/30 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-800">
                <TrendingUp className="h-4 w-4" /> Top Bullish Signals
              </h3>
              {topMoversBullish.map((a, i) => (
                <div key={a.id} className="mb-3 flex items-start gap-3 last:mb-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-xs font-bold text-emerald-800">{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{a.company}</span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-700">{(a.sentimentScore * 100).toFixed(0)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 leading-snug">{a.headline}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Top Bearish */}
            <div className="rounded-xl border-2 border-red-200 bg-red-50/30 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-red-800">
                <TrendingDown className="h-4 w-4" /> Top Bearish Signals
              </h3>
              {topMoversBearish.map((a, i) => (
                <div key={a.id} className="mb-3 flex items-start gap-3 last:mb-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-200 text-xs font-bold text-red-800">{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{a.company}</span>
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">{(a.sentimentScore * 100).toFixed(0)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 leading-snug">{a.headline}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ STATISTICS TABLE ═══════════ */}
        <section className="mb-10">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">
            <Activity className="h-5 w-5 text-blue-600" /> Statistical Summary
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Metric</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Total Headlines Analyzed', metrics.total.toString(), 'Across all sectors in the last 24 hours'],
                  ['Bullish / Bearish / Neutral', `${metrics.bullish} / ${metrics.bearish} / ${metrics.neutral}`, `Bull-Bear ratio: ${metrics.bearish > 0 ? (metrics.bullish / metrics.bearish).toFixed(2) : 'N/A'}`],
                  ['Average Sentiment Score', `${(metrics.avgSentiment * 100).toFixed(1)} / 100`, metrics.avgSentiment >= 0.55 ? 'Positive bias' : metrics.avgSentiment <= 0.45 ? 'Negative bias' : 'Neutral range'],
                  ['Average Confidence', `${metrics.avgConfidence}%`, `${metrics.highConfCount} analyses with high confidence (85%+)`],
                  ['Strongest Sector', sectors.sort((a, b) => b.sentimentScore - a.sentimentScore)[0]?.label || 'N/A', `Score: ${(Math.max(...sectors.map(s => s.sentimentScore)) * 100).toFixed(0)}`],
                  ['Weakest Sector', [...sectors].sort((a, b) => a.sentimentScore - b.sentimentScore)[0]?.label || 'N/A', `Score: ${(Math.min(...sectors.map(s => s.sentimentScore)) * 100).toFixed(0)}`],
                  ['Total Sectors Covered', sectors.length.toString(), sectors.map(s => s.label).join(', ')],
                  ['Report Coverage Period', '24 hours', `Generated ${reportTime}`],
                ].map(([metric, value, notes], i) => (
                  <tr key={metric} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{metric}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">{value}</td>
                    <td className="px-4 py-2.5 text-slate-500">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════ DISCLAIMER ═══════════ */}
        <footer className="border-t-2 border-slate-900 pt-6 pb-10">
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-xs leading-relaxed text-slate-500">
              <p className="mb-1 font-semibold text-slate-700">Important Disclosure</p>
              <p>
                This report is generated by an AI-powered sentiment analysis system and is intended for informational
                purposes only. It does not constitute financial advice, investment recommendation, or an offer to buy or
                sell any securities. Sentiment scores are derived from natural language processing of publicly available
                news headlines and may not reflect the complete market picture. Past performance is not indicative of
                future results. Always conduct your own due diligence and consult with a qualified financial advisor
                before making investment decisions.
              </p>
              <p className="mt-2 text-slate-400">
                Powered by Databricks AI &mdash; Equity News Analyst v1.0 &mdash; {reportDate}
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .report-page { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .break-before-page { break-before: page; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 0.75in; size: letter; }
        }
      `}</style>
    </div>
  );
}
