import { useMemo } from 'react';
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, PieChart as PieChartIcon } from 'lucide-react';

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

interface SentimentDashboardProps {
  analyses: NewsAnalysis[];
}

// Color scheme
const COLORS = {
  bullish: '#22c55e',
  bearish: '#ef4444',
  neutral: '#eab308',
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  background: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(255, 255, 255, 0.1)',
  text: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
};

// Generate synthetic historical data for demo
const generateSyntheticTrendData = (analyses: NewsAnalysis[]) => {
  const now = new Date();
  const data = [];

  // Generate 14 days of data
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Use real data for recent days if available, otherwise synthetic
    const dayAnalyses = analyses.filter(a => {
      const aDate = new Date(a.timestamp);
      return aDate.toDateString() === date.toDateString();
    });

    if (dayAnalyses.length > 0) {
      const avgScore = dayAnalyses.reduce((acc, a) => acc + a.sentimentScore, 0) / dayAnalyses.length;
      data.push({
        date: dateStr,
        sentiment: Math.round(avgScore * 100) / 100,
        volume: dayAnalyses.length,
        bullish: dayAnalyses.filter(a => a.status === 'bullish').length,
        bearish: dayAnalyses.filter(a => a.status === 'bearish').length,
      });
    } else {
      // Synthetic data with some randomness
      const baseSentiment = 0.5 + (Math.random() - 0.5) * 0.4;
      const volume = Math.floor(Math.random() * 10) + 3;
      data.push({
        date: dateStr,
        sentiment: Math.round(baseSentiment * 100) / 100,
        volume,
        bullish: Math.floor(volume * baseSentiment),
        bearish: Math.floor(volume * (1 - baseSentiment)),
      });
    }
  }

  return data;
};

// Generate company breakdown data
const generateCompanyData = (analyses: NewsAnalysis[]) => {
  const companyMap = new Map<string, { bullish: number; bearish: number; neutral: number; total: number }>();

  analyses.forEach(a => {
    const company = a.company || 'Unknown';
    if (!companyMap.has(company)) {
      companyMap.set(company, { bullish: 0, bearish: 0, neutral: 0, total: 0 });
    }
    const data = companyMap.get(company)!;
    data[a.status]++;
    data.total++;
  });

  // Add some synthetic companies if not enough real data
  const syntheticCompanies = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'NVDA', 'META'];
  syntheticCompanies.forEach(company => {
    if (!companyMap.has(company) && companyMap.size < 6) {
      const bullish = Math.floor(Math.random() * 5) + 1;
      const bearish = Math.floor(Math.random() * 3);
      const neutral = Math.floor(Math.random() * 2);
      companyMap.set(company, { bullish, bearish, neutral, total: bullish + bearish + neutral });
    }
  });

  return Array.from(companyMap.entries())
    .map(([company, data]) => ({ company, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
};

// Metric Card Component
const MetricCard = ({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  color = 'primary',
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'bullish' | 'bearish' | 'neutral';
}) => {
  const colorMap = {
    primary: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    bullish: 'text-green-400 bg-green-400/10 border-green-400/30',
    bearish: 'text-red-400 bg-red-400/10 border-red-400/30',
    neutral: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className='mb-1 text-white/50 text-xs'>{title}</p>
          <p className='font-bold text-2xl text-white'>{value}</p>
          {subValue && (
            <p className={`mt-1 text-sm ${
              trend === 'up' ? 'text-green-400' :
              trend === 'down' ? 'text-red-400' :
              'text-white/50'
            }`}>
              {trend === 'up' && '↑ '}
              {trend === 'down' && '↓ '}
              {subValue}
            </p>
          )}
        </div>
        <div className={`rounded-lg border p-2 ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-white/20 bg-gray-900/95 px-3 py-2 shadow-xl">
        <p className='mb-1 text-white/70 text-xs'>{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className='font-medium text-sm' style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function SentimentDashboard({ analyses }: SentimentDashboardProps) {
  // Filter out loading items
  const completedAnalyses = analyses.filter(a => !a.isLoading);

  // Calculate metrics
  const metrics = useMemo(() => {
    const bullishCount = completedAnalyses.filter(a => a.status === 'bullish').length;
    const bearishCount = completedAnalyses.filter(a => a.status === 'bearish').length;
    const neutralCount = completedAnalyses.filter(a => a.status === 'neutral').length;
    const total = completedAnalyses.length;

    const avgConfidence = total > 0
      ? Math.round(completedAnalyses.reduce((acc, a) => acc + a.confidencePercent, 0) / total)
      : 0;

    const avgSentiment = total > 0
      ? Math.round(completedAnalyses.reduce((acc, a) => acc + a.sentimentScore, 0) / total * 100) / 100
      : 0.5;

    // Find most mentioned company
    const companyCounts = completedAnalyses.reduce((acc, a) => {
      if (a.company) {
        acc[a.company] = (acc[a.company] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topCompany = Object.entries(companyCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      total,
      bullishCount,
      bearishCount,
      neutralCount,
      bullishPercent: total > 0 ? Math.round((bullishCount / total) * 100) : 0,
      bearishPercent: total > 0 ? Math.round((bearishCount / total) * 100) : 0,
      avgConfidence,
      avgSentiment,
      topCompany: topCompany ? topCompany[0] : 'N/A',
    };
  }, [completedAnalyses]);

  // Generate chart data
  const trendData = useMemo(() => generateSyntheticTrendData(completedAnalyses), [completedAnalyses]);
  const companyData = useMemo(() => generateCompanyData(completedAnalyses), [completedAnalyses]);

  // Pie chart data for sentiment distribution
  const pieData = [
    { name: 'Bullish', value: metrics.bullishCount || 3, color: COLORS.bullish },
    { name: 'Bearish', value: metrics.bearishCount || 2, color: COLORS.bearish },
    { name: 'Neutral', value: metrics.neutralCount || 1, color: COLORS.neutral },
  ];

  // Radar chart data for portfolio health
  const radarData = [
    { metric: 'Confidence', value: metrics.avgConfidence, fullMark: 100 },
    { metric: 'Volume', value: Math.min(metrics.total * 10, 100), fullMark: 100 },
    { metric: 'Bullish', value: metrics.bullishPercent, fullMark: 100 },
    { metric: 'Diversity', value: companyData.length * 16, fullMark: 100 },
    { metric: 'Sentiment', value: metrics.avgSentiment * 100, fullMark: 100 },
  ];

  return (
    <div className='h-full space-y-4 overflow-y-auto p-4'>
      {/* Header */}
      <div className='mb-2 flex items-center justify-between'>
        <h2 className='font-semibold text-lg text-white'>Market Sentiment Overview</h2>
        <span className='text-white/40 text-xs'>Live • Demo Data</span>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="Total Analyses"
          value={metrics.total || 12}
          subValue="Last 24h"
          icon={Activity}
          color="primary"
        />
        <MetricCard
          title="Bullish Ratio"
          value={`${metrics.bullishPercent || 58}%`}
          subValue={`${metrics.bullishCount || 7} signals`}
          icon={TrendingUp}
          trend="up"
          color="bullish"
        />
        <MetricCard
          title="Bearish Ratio"
          value={`${metrics.bearishPercent || 25}%`}
          subValue={`${metrics.bearishCount || 3} signals`}
          icon={TrendingDown}
          trend="down"
          color="bearish"
        />
        <MetricCard
          title="Avg Confidence"
          value={`${metrics.avgConfidence || 78}%`}
          subValue="High"
          icon={Target}
          color="primary"
        />
      </div>

      {/* Sentiment Trend Chart */}
      <div id="chart-sentiment-trend" className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <div className='mb-4 flex items-center gap-2'>
          <BarChart3 className="h-4 w-4 text-white/50" />
          <h3 className='font-medium text-sm text-white'>Sentiment Trend (14 Days)</h3>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                tick={{ fill: COLORS.textMuted, fontSize: 10 }}
                axisLine={{ stroke: COLORS.border }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fill: COLORS.textMuted, fontSize: 10 }}
                axisLine={{ stroke: COLORS.border }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="sentiment"
                stroke={COLORS.primary}
                strokeWidth={2}
                fill="url(#sentimentGradient)"
                name="Sentiment"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column: Pie Chart + Radar Chart */}
      <div className="grid grid-cols-2 gap-3">
        {/* Distribution Pie */}
        <div id="chart-sentiment-distribution" className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <div className='mb-2 flex items-center gap-2'>
            <PieChartIcon className="h-4 w-4 text-white/50" />
            <h3 className='font-medium text-sm text-white'>Distribution</h3>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={45}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className='mt-2 flex justify-center gap-4'>
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1">
                <div className='h-2 w-2 rounded-full' style={{ backgroundColor: entry.color }} />
                <span className='text-white/50 text-xs'>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio Health Radar */}
        <div id="chart-portfolio-health" className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <h3 className='mb-2 font-medium text-sm text-white'>Portfolio Health</h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: COLORS.textMuted, fontSize: 8 }}
                />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar
                  name="Health"
                  dataKey="value"
                  stroke={COLORS.secondary}
                  fill={COLORS.secondary}
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Company Breakdown */}
      <div id="chart-company-breakdown" className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <h3 className='mb-3 font-medium text-sm text-white'>Company Sentiment Breakdown</h3>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={companyData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
              <XAxis type="number" tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
              <YAxis
                dataKey="company"
                type="category"
                tick={{ fill: COLORS.text, fontSize: 10 }}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="bullish" stackId="a" fill={COLORS.bullish} name="Bullish" />
              <Bar dataKey="bearish" stackId="a" fill={COLORS.bearish} name="Bearish" />
              <Bar dataKey="neutral" stackId="a" fill={COLORS.neutral} name="Neutral" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Market Pulse - Quick Stats */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 backdrop-blur-sm">
        <h3 className='mb-2 font-medium text-sm text-white'>Market Pulse</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className='text-white/50 text-xs'>Average Sentiment Score</p>
            <p className='font-bold text-3xl text-white'>{(metrics.avgSentiment || 0.62).toFixed(2)}</p>
          </div>
          <div className={`rounded-lg px-4 py-2 ${
            (metrics.avgSentiment || 0.62) > 0.5
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {(metrics.avgSentiment || 0.62) > 0.5 ? (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <span className="font-semibold">BULLISH</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                <span className="font-semibold">BEARISH</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
