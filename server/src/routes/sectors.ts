import {
  Router,
  type Request,
  type Response,
  type Router as RouterType,
} from 'express';
import {
  saveSectorNewsBatch,
  getTopSectorNews,
  getSectorNewsCount,
} from '@chat-template/db';
import {
  SECTORS,
  classifySector,
  computeImpactScore,
} from '../config/sectors';

export const sectorsRouter: RouterType = Router();

// All 50 fallback headlines matching the frontend's FALLBACK_HEADLINES array.
// Each gets auto-classified by sector via classifySector() and assigned a
// realistic sentiment score. When the app starts, these seed the banner.
// Real RSS headlines + user analyses are added on top.
const SEED_HEADLINES: Array<{
  headline: string;
  sentimentStatus: string;
  sentimentScore: number;
  confidence: string;
  confidencePercent: number;
  rationale: string;
}> = [
  // Technology (10)
  { headline: 'Apple announces record-breaking iPhone sales in Q4, beating analyst expectations by 15%', sentimentStatus: 'bullish', sentimentScore: 0.87, confidence: 'high', confidencePercent: 91, rationale: 'Record sales with significant beat signals strong consumer demand' },
  { headline: 'NVIDIA shares surge 8% after unveiling next-generation AI chips with 3x performance gains', sentimentStatus: 'bullish', sentimentScore: 0.9, confidence: 'high', confidencePercent: 93, rationale: 'Major product launch reinforcing AI hardware leadership' },
  { headline: 'Microsoft Azure revenue grows 29% YoY, cloud division now accounts for 50% of total revenue', sentimentStatus: 'bullish', sentimentScore: 0.84, confidence: 'high', confidencePercent: 89, rationale: 'Strong cloud growth exceeding expectations' },
  { headline: 'Google parent Alphabet announces $70 billion stock buyback program', sentimentStatus: 'bullish', sentimentScore: 0.81, confidence: 'high', confidencePercent: 88, rationale: 'Massive shareholder return signals confidence' },
  { headline: 'Meta Platforms faces EU antitrust investigation, potential $2B fine looms', sentimentStatus: 'bearish', sentimentScore: 0.3, confidence: 'medium', confidencePercent: 72, rationale: 'Regulatory risk with potential material fine' },
  { headline: 'Intel warns of weaker-than-expected guidance, cites PC market slowdown', sentimentStatus: 'bearish', sentimentScore: 0.25, confidence: 'high', confidencePercent: 87, rationale: 'Guidance cut reflects structural demand weakness' },
  { headline: 'AMD gains market share in data center CPUs, stock rises on positive analyst coverage', sentimentStatus: 'bullish', sentimentScore: 0.76, confidence: 'medium', confidencePercent: 78, rationale: 'Market share gains in high-margin segment' },
  { headline: 'Salesforce acquires AI startup for $2.8 billion to boost Einstein platform', sentimentStatus: 'bullish', sentimentScore: 0.7, confidence: 'medium', confidencePercent: 72, rationale: 'Strategic AI acquisition though integration risk exists' },
  { headline: 'Qualcomm settles patent dispute with Huawei, opens new revenue stream', sentimentStatus: 'bullish', sentimentScore: 0.73, confidence: 'medium', confidencePercent: 75, rationale: 'Dispute resolution unlocks licensing revenue' },
  { headline: 'NVIDIA data center revenue doubles to $26B as AI spending accelerates globally', sentimentStatus: 'bullish', sentimentScore: 0.92, confidence: 'high', confidencePercent: 95, rationale: 'Exceptional revenue growth in highest-margin segment' },
  // Healthcare (8)
  { headline: 'Moderna begins Phase 3 trials for combined flu-COVID vaccine', sentimentStatus: 'bullish', sentimentScore: 0.71, confidence: 'medium', confidencePercent: 70, rationale: 'Promising pipeline advancement but outcomes uncertain' },
  { headline: 'Eli Lilly weight loss drug sales top $5B in first full quarter on market', sentimentStatus: 'bullish', sentimentScore: 0.89, confidence: 'high', confidencePercent: 93, rationale: 'Blockbuster drug launch exceeding all projections' },
  { headline: 'Pfizer announces $43B acquisition of cancer therapy biotech startup', sentimentStatus: 'bullish', sentimentScore: 0.68, confidence: 'medium', confidencePercent: 70, rationale: 'Large acquisition to offset patent cliff but execution risk' },
  { headline: 'UnitedHealth Group raises full-year guidance on strong Medicare Advantage enrollment', sentimentStatus: 'bullish', sentimentScore: 0.79, confidence: 'high', confidencePercent: 85, rationale: 'Guidance raise from strong enrollment trends' },
  { headline: 'FDA fast-tracks approval for breakthrough Alzheimer\'s drug from Merck', sentimentStatus: 'bullish', sentimentScore: 0.83, confidence: 'high', confidencePercent: 87, rationale: 'Fast-track designation indicates promising clinical data' },
  { headline: 'Johnson & Johnson spins off consumer health division in $40B deal', sentimentStatus: 'neutral', sentimentScore: 0.55, confidence: 'medium', confidencePercent: 68, rationale: 'Restructuring may unlock value but adds complexity' },
  { headline: 'AbbVie reports Humira biosimilar competition less severe than feared', sentimentStatus: 'bullish', sentimentScore: 0.74, confidence: 'high', confidencePercent: 82, rationale: 'Better-than-expected resilience against biosimilar entry' },
  { headline: 'Biotech stocks rally as clinical trial data shows 90% efficacy in rare disease treatment', sentimentStatus: 'bullish', sentimentScore: 0.82, confidence: 'high', confidencePercent: 85, rationale: 'Exceptional clinical data driving sector-wide optimism' },
  // Energy (8)
  { headline: 'ExxonMobil reports record quarterly profit on strong refining margins', sentimentStatus: 'bullish', sentimentScore: 0.83, confidence: 'high', confidencePercent: 91, rationale: 'Exceptional financial performance exceeding expectations' },
  { headline: 'OPEC+ agrees to extend production cuts through Q3, crude oil rises 4%', sentimentStatus: 'bullish', sentimentScore: 0.76, confidence: 'high', confidencePercent: 85, rationale: 'Supply constraints support higher oil prices' },
  { headline: 'Chevron completes $53B acquisition of Hess, creating energy mega-giant', sentimentStatus: 'bullish', sentimentScore: 0.72, confidence: 'medium', confidencePercent: 75, rationale: 'Scale benefits but integration risk and premium paid' },
  { headline: 'Solar installations hit record high as panel costs drop 20% globally', sentimentStatus: 'neutral', sentimentScore: 0.55, confidence: 'medium', confidencePercent: 65, rationale: 'Mixed - positive for renewables, pressure on traditional energy' },
  { headline: 'US crude oil inventories fall to lowest level in 18 months, prices surge', sentimentStatus: 'bullish', sentimentScore: 0.78, confidence: 'high', confidencePercent: 84, rationale: 'Tight supply supporting price recovery' },
  { headline: 'Schlumberger sees 15% rise in international drilling activity for 2026', sentimentStatus: 'bullish', sentimentScore: 0.74, confidence: 'medium', confidencePercent: 78, rationale: 'Positive outlook for oilfield services demand' },
  { headline: 'ConocoPhillips discovers major offshore oil field in Gulf of Mexico', sentimentStatus: 'bullish', sentimentScore: 0.77, confidence: 'high', confidencePercent: 82, rationale: 'Significant resource discovery adds long-term value' },
  { headline: 'European natural gas prices spike 30% on supply disruption fears', sentimentStatus: 'bearish', sentimentScore: 0.32, confidence: 'high', confidencePercent: 80, rationale: 'Supply disruption creating market volatility' },
  // Financials (8)
  { headline: 'JPMorgan raises S&P 500 target to 5,500 citing strong corporate earnings', sentimentStatus: 'bullish', sentimentScore: 0.74, confidence: 'medium', confidencePercent: 70, rationale: 'Bullish outlook from major bank' },
  { headline: 'Goldman Sachs downgrades retail sector, warns of consumer spending slowdown', sentimentStatus: 'bearish', sentimentScore: 0.29, confidence: 'high', confidencePercent: 83, rationale: 'Sector downgrade warns of macro spending weakness' },
  { headline: 'Visa reports 12% increase in cross-border transactions, international travel booms', sentimentStatus: 'bullish', sentimentScore: 0.78, confidence: 'high', confidencePercent: 84, rationale: 'Strong cross-border volume growth' },
  { headline: 'PayPal cuts 2,000 jobs amid fintech sector restructuring, shares dip 3%', sentimentStatus: 'bearish', sentimentScore: 0.32, confidence: 'high', confidencePercent: 82, rationale: 'Layoffs signal cost pressures and competitive headwinds' },
  { headline: 'Federal Reserve holds rates steady, signals potential cut in September', sentimentStatus: 'bullish', sentimentScore: 0.69, confidence: 'medium', confidencePercent: 72, rationale: 'Rate cut signal generally positive for financial valuations' },
  { headline: 'Bank of America reports 22% jump in investment banking revenue', sentimentStatus: 'bullish', sentimentScore: 0.79, confidence: 'high', confidencePercent: 86, rationale: 'Strong IB revenue recovery signals deal activity pickup' },
  { headline: 'Morgan Stanley wealth management division hits record $5T in client assets', sentimentStatus: 'bullish', sentimentScore: 0.77, confidence: 'high', confidencePercent: 83, rationale: 'Record AUM milestone in high-margin business' },
  { headline: 'BlackRock AUM surpasses $11 trillion milestone on ETF inflows surge', sentimentStatus: 'bullish', sentimentScore: 0.8, confidence: 'high', confidencePercent: 87, rationale: 'Continued dominance in passive investing driving asset growth' },
  // Consumer (8)
  { headline: 'Amazon Web Services wins $10 billion Pentagon contract, shares jump 4%', sentimentStatus: 'bullish', sentimentScore: 0.82, confidence: 'high', confidencePercent: 90, rationale: 'Massive government contract win' },
  { headline: 'Tesla reports disappointing delivery numbers, stock falls 5% in pre-market trading', sentimentStatus: 'bearish', sentimentScore: 0.28, confidence: 'high', confidencePercent: 86, rationale: 'Delivery miss signals demand weakness' },
  { headline: 'Netflix subscriber growth exceeds expectations, adds 13 million new users globally', sentimentStatus: 'bullish', sentimentScore: 0.8, confidence: 'high', confidencePercent: 85, rationale: 'Strong subscriber additions beating estimates' },
  { headline: 'Disney+ reaches 150 million subscribers, narrows streaming losses significantly', sentimentStatus: 'bullish', sentimentScore: 0.77, confidence: 'high', confidencePercent: 82, rationale: 'Path to streaming profitability becoming clearer' },
  { headline: 'Uber reports first annual profit in company history, shares rally 10%', sentimentStatus: 'bullish', sentimentScore: 0.85, confidence: 'high', confidencePercent: 91, rationale: 'Historic profitability milestone' },
  { headline: 'Nike revenue misses estimates as China demand weakens, shares drop 6%', sentimentStatus: 'bearish', sentimentScore: 0.27, confidence: 'high', confidencePercent: 84, rationale: 'Revenue miss with weakness in key growth market' },
  { headline: 'Starbucks same-store sales fall 3% in US as consumers cut discretionary spending', sentimentStatus: 'bearish', sentimentScore: 0.31, confidence: 'high', confidencePercent: 81, rationale: 'Comparable sales decline signals consumer pullback' },
  { headline: 'Target beats earnings expectations with strong grocery and essentials growth', sentimentStatus: 'bullish', sentimentScore: 0.74, confidence: 'high', confidencePercent: 80, rationale: 'Earnings beat driven by essential categories' },
  // Industrials (8)
  { headline: 'Boeing 737 MAX receives FAA approval for expanded operations in Asia', sentimentStatus: 'bullish', sentimentScore: 0.72, confidence: 'medium', confidencePercent: 73, rationale: 'Positive regulatory milestone for key product' },
  { headline: 'Caterpillar raises full-year guidance on infrastructure spending boom', sentimentStatus: 'bullish', sentimentScore: 0.81, confidence: 'high', confidencePercent: 88, rationale: 'Guidance raise reflects strong infrastructure demand' },
  { headline: 'Lockheed Martin wins $15B defense contract for next-gen fighter jets', sentimentStatus: 'bullish', sentimentScore: 0.85, confidence: 'high', confidencePercent: 94, rationale: 'Major contract win securing long-term revenue' },
  { headline: 'UPS announces 12,000 layoffs as package volume continues to decline', sentimentStatus: 'bearish', sentimentScore: 0.28, confidence: 'high', confidencePercent: 85, rationale: 'Significant workforce reduction signals demand challenges' },
  { headline: 'Honeywell completes acquisition of Carrier Global for $5B in industrial consolidation', sentimentStatus: 'bullish', sentimentScore: 0.7, confidence: 'medium', confidencePercent: 72, rationale: 'Strategic acquisition adds scale in HVAC segment' },
  { headline: 'General Electric Vernova sees record wind turbine orders amid renewable energy push', sentimentStatus: 'bullish', sentimentScore: 0.76, confidence: 'medium', confidencePercent: 78, rationale: 'Record orders demonstrate energy transition demand' },
  { headline: 'Raytheon delivers first batch of next-gen air defense systems to NATO allies', sentimentStatus: 'bullish', sentimentScore: 0.78, confidence: 'high', confidencePercent: 84, rationale: 'Defense delivery milestone with strong geopolitical tailwind' },
  { headline: 'Boeing faces new scrutiny as whistleblower reports quality concerns on 787 Dreamliner', sentimentStatus: 'bearish', sentimentScore: 0.24, confidence: 'high', confidencePercent: 88, rationale: 'Quality concerns adding to ongoing reputational damage' },
];

type SeedItem = {
  sectorId: string;
  headline: string;
  source: string;
  relatedSymbols: string[];
  sentimentStatus: string;
  sentimentScore: number;
  confidence: string;
  confidencePercent: number;
  impactScore: number;
  rationale: string;
  analyzedAt: Date;
};

function buildSeedItems(headlines: typeof SEED_HEADLINES): SeedItem[] {
  const now = new Date();
  const items: SeedItem[] = [];

  for (let i = 0; i < headlines.length; i++) {
    const h = headlines[i];
    const sectorId = classifySector(h.headline);
    if (!sectorId) continue;

    items.push({
      sectorId,
      headline: h.headline,
      source: 'news-feed',
      relatedSymbols: [],
      sentimentStatus: h.sentimentStatus,
      sentimentScore: h.sentimentScore,
      confidence: h.confidence,
      confidencePercent: h.confidencePercent,
      impactScore: computeImpactScore(
        h.sentimentScore,
        h.confidencePercent,
      ),
      rationale: h.rationale,
      analyzedAt: new Date(now.getTime() - i * 60 * 1000 * 5),
    });
  }

  return items;
}

// Seed data if table is empty
async function seedIfEmpty() {
  try {
    const count = await getSectorNewsCount();
    if (count > 0) {
      console.log(
        `[Sectors] SectorNews already has ${count} rows, skipping seed`,
      );
      return;
    }

    console.log('[Sectors] Seeding SectorNews with 50 headlines...');
    const items = buildSeedItems(SEED_HEADLINES);
    await saveSectorNewsBatch(items);
    console.log(
      `[Sectors] Seeded ${items.length} headlines across sectors`,
    );
  } catch (error) {
    console.error('[Sectors] Seed error:', error);
  }
}

// Seed on import (server startup)
seedIfEmpty();

// GET /api/sectors/banner
sectorsRouter.get('/banner', async (_req: Request, res: Response) => {
  try {
    const allNews = await getTopSectorNews();

    // Group by sector
    const bySector: Record<
      string,
      Array<(typeof allNews)[number]>
    > = {};
    for (const item of allNews) {
      if (!bySector[item.sectorId]) {
        bySector[item.sectorId] = [];
      }
      bySector[item.sectorId].push(item);
    }

    // Build response for each sector
    const sectors = Object.entries(SECTORS).map(([sectorId, config]) => {
      const items = bySector[sectorId] || [];
      const avgScore =
        items.length > 0
          ? items.reduce((sum, i) => sum + i.sentimentScore, 0) /
            items.length
          : 0.5;

      // Sort by impactScore desc, take top 2
      const sorted = [...items].sort(
        (a, b) => b.impactScore - a.impactScore,
      );
      const topHeadlines = sorted.slice(0, 2).map((item) => ({
        id: item.id,
        headline: item.headline,
        sentimentStatus: item.sentimentStatus,
        sentimentScore: item.sentimentScore,
        impactScore: item.impactScore,
        relatedSymbols: item.relatedSymbols,
        analyzedAt: item.analyzedAt,
      }));

      return {
        sectorId,
        label: config.label,
        icon: config.icon,
        color: config.color,
        sentimentScore: Math.round(avgScore * 100) / 100,
        newsCount: items.length,
        topHeadlines,
      };
    });

    // Sort sectors by aggregate impact (distance from 0.5 * newsCount)
    sectors.sort((a, b) => {
      const impactA = Math.abs(a.sentimentScore - 0.5) * a.newsCount;
      const impactB = Math.abs(b.sentimentScore - 0.5) * b.newsCount;
      return impactB - impactA;
    });

    res.json({ sectors });
  } catch (error) {
    console.error('[Sectors] Banner error:', error);
    res.status(500).json({ error: 'Failed to get sector banner data' });
  }
});

// POST /api/sectors/seed - Force re-seed
sectorsRouter.post('/seed', async (_req: Request, res: Response) => {
  try {
    const items = buildSeedItems(SEED_HEADLINES);
    const result = await saveSectorNewsBatch(items);
    res.json({ seeded: result.length });
  } catch (error) {
    console.error('[Sectors] Seed error:', error);
    res.status(500).json({ error: 'Failed to seed sector data' });
  }
});
