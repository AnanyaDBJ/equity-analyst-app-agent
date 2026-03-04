import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Heart,
  Zap,
  DollarSign,
  ShoppingBag,
  Factory,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Newspaper,
} from 'lucide-react';
import { fetcher } from '@/lib/utils';

const STORAGE_KEY = 'sector-banner-expanded';

const ICON_MAP: Record<string, React.ElementType> = {
  Monitor,
  Heart,
  Zap,
  DollarSign,
  ShoppingBag,
  Factory,
};

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

interface BannerResponse {
  sectors: SectorData[];
}

function getSentimentColor(score: number) {
  if (score >= 0.6) return '#22c55e';
  if (score <= 0.4) return '#ef4444';
  return '#eab308';
}

function getSentimentLabel(status: string) {
  if (status === 'bullish') return 'Bullish';
  if (status === 'bearish') return 'Bearish';
  return 'Neutral';
}

function SentimentBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    bullish: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    bearish: 'bg-red-500/20 text-red-400 border-red-500/30',
    neutral: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };

  const IconComponent =
    status === 'bullish'
      ? TrendingUp
      : status === 'bearish'
        ? TrendingDown
        : Minus;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-xs ${colors[status] || colors.neutral}`}
    >
      <IconComponent className="h-3 w-3" />
      {getSentimentLabel(status)}
    </span>
  );
}

function SectorCard({
  sector,
  isSelected,
  onClick,
}: {
  sector: SectorData;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = ICON_MAP[sector.icon] || Monitor;
  const sentColor = getSentimentColor(sector.sentimentScore);
  const barWidth = `${Math.round(sector.sentimentScore * 100)}%`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-w-[155px] flex-col gap-2 rounded-lg border p-3 transition-all duration-200 ${
        isSelected
          ? 'border-opacity-60 bg-white/10'
          : 'border-white/10 bg-white/5 hover:bg-white/8'
      }`}
      style={{
        borderColor: isSelected ? sector.color : undefined,
        boxShadow: isSelected ? `0 0 12px ${sector.color}30` : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: sector.color }} />
          <span className="font-semibold text-white text-xs">
            {sector.label}
          </span>
        </div>
        <ChevronDown
          className={`h-3 w-3 text-white/40 transition-transform duration-200 ${
            isSelected ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Sentiment bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: barWidth,
            backgroundColor: sentColor,
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="font-medium text-xs" style={{ color: sentColor }}>
          {Math.round(sector.sentimentScore * 100)}%
        </span>
        <span className="text-white/40 text-xs">
          {sector.newsCount} article{sector.newsCount !== 1 ? 's' : ''}
        </span>
      </div>
    </button>
  );
}

function ExpansionPanel({ sector }: { sector: SectorData }) {
  const sentColor = getSentimentColor(sector.sentimentScore);
  const bullish = sector.topHeadlines.filter(
    (h) => h.sentimentStatus === 'bullish',
  ).length;
  const bearish = sector.topHeadlines.filter(
    (h) => h.sentimentStatus === 'bearish',
  ).length;
  const neutral = sector.topHeadlines.filter(
    (h) => h.sentimentStatus === 'neutral',
  ).length;
  const total = sector.topHeadlines.length || 1;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="overflow-hidden"
    >
      <div className="mt-3 grid grid-cols-1 gap-4 rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm md:grid-cols-3">
        {/* Left: Sector aggregate stats */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: sector.color }}
            />
            <span className="font-semibold text-sm text-white">
              {sector.label} Sentiment
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-bold text-3xl" style={{ color: sentColor }}>
              {Math.round(sector.sentimentScore * 100)}
            </span>
            <span className="text-sm text-white/40">/ 100</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-400">Bullish</span>
              <span className="text-white/60">
                {Math.round((bullish / total) * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-red-400">Bearish</span>
              <span className="text-white/60">
                {Math.round((bearish / total) * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-yellow-400">Neutral</span>
              <span className="text-white/60">
                {Math.round((neutral / total) * 100)}%
              </span>
            </div>
          </div>

          <div className="mt-1 text-white/40 text-xs">
            {sector.newsCount} total article
            {sector.newsCount !== 1 ? 's' : ''} analyzed
          </div>
        </div>

        {/* Right: Top headlines */}
        <div className="col-span-2 flex flex-col gap-3">
          <span className="font-medium text-white/60 text-xs">
            Top Impact Headlines
          </span>
          {sector.topHeadlines.length === 0 ? (
            <div className="text-sm text-white/30">No headlines yet</div>
          ) : (
            sector.topHeadlines.map((h) => (
              <div
                key={h.id}
                className="rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="flex-1 text-sm text-white/90 leading-snug">
                    {h.headline}
                  </p>
                  <SentimentBadge status={h.sentimentStatus} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/40 text-xs">
                    Impact:{' '}
                    <span className="text-white/70">
                      {(h.impactScore * 100).toFixed(0)}
                    </span>
                  </span>
                  {h.relatedSymbols && h.relatedSymbols.length > 0 && (
                    <div className="flex gap-1">
                      {h.relatedSymbols.map((sym) => (
                        <span
                          key={sym}
                          className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70 text-xs"
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="ml-auto text-white/30 text-xs">
                    {new Date(h.analyzedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function SectorImpactBanner() {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(() => {
    // Check localStorage for user preference, default to collapsed
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'true';
    }
    return false;
  });

  const { data } = useSWR<BannerResponse>('/api/sectors/banner', fetcher, {
    refreshInterval: 30000,
  });

  // Persist expanded state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isExpanded));
  }, [isExpanded]);

  if (!data || !data.sectors || data.sectors.length === 0) {
    return null;
  }

  const selected = data.sectors.find((s) => s.sectorId === selectedSector);

  // Calculate aggregate stats for collapsed summary
  const totalArticles = data.sectors.reduce((sum, s) => sum + s.newsCount, 0);
  const avgSentiment = data.sectors.length > 0
    ? Math.round(data.sectors.reduce((sum, s) => sum + s.sentimentScore, 0) / data.sectors.length * 100)
    : 0;
  const sentimentColor = avgSentiment >= 60 ? 'text-emerald-400' : avgSentiment <= 40 ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className="mb-4">
      {/* Collapsed summary bar - clickable to expand */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mb-2 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition-colors hover:bg-white/8"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white/70 text-xs uppercase tracking-wider">
            Sector Impact
          </h3>
          {!isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4 text-xs"
            >
              <span className={`flex items-center gap-1 ${sentimentColor}`}>
                {avgSentiment >= 60 ? <TrendingUp className="h-3 w-3" /> : avgSentiment <= 40 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {avgSentiment}% sentiment
              </span>
              <span className="flex items-center gap-1 text-white/50">
                <Newspaper className="h-3 w-3" />
                {totalArticles} articles
              </span>
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-1 text-white/40">
          <span className="text-xs">{isExpanded ? 'Collapse' : 'Expand'}</span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Horizontal scroll of sector cards */}
            <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 flex gap-2 overflow-x-auto pb-1">
              {data.sectors.map((sector) => (
                <SectorCard
                  key={sector.sectorId}
                  sector={sector}
                  isSelected={selectedSector === sector.sectorId}
                  onClick={() =>
                    setSelectedSector(
                      selectedSector === sector.sectorId ? null : sector.sectorId,
                    )
                  }
                />
              ))}
            </div>

            {/* Expansion panel for selected sector */}
            <AnimatePresence mode="wait">
              {selected && (
                <ExpansionPanel key={selected.sectorId} sector={selected} />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
