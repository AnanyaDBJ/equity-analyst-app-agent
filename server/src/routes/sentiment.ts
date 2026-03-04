import {
  Router,
  type Request,
  type Response,
  type Router as RouterType,
} from 'express';
import { authMiddleware, requireAuth } from '../middleware/auth';
import {
  getDatabricksToken,
  getAuthMethod,
  getDatabricksUserIdentity,
  getCachedCliHost,
} from '@chat-template/auth';
import { getHostUrl } from '@chat-template/utils';
import {
  saveSentimentAnalysis,
  getSentimentAnalysesByUserId,
  clearSentimentAnalysesByUserId,
  deleteSentimentAnalysis,
  saveSectorNewsItem,
} from '@chat-template/db';
import { classifySector, computeImpactScore } from '../config/sectors';

export const sentimentRouter: RouterType = Router();

sentimentRouter.use(authMiddleware);

// Cache for workspace hostname
let cachedHostname: string | null = null;

// Get workspace hostname with caching
async function getWorkspaceHostname(): Promise<string> {
  if (cachedHostname) {
    return cachedHostname;
  }

  const authMethod = getAuthMethod();

  if (authMethod === 'cli') {
    await getDatabricksUserIdentity();
    const cliHost = getCachedCliHost();
    if (cliHost) {
      cachedHostname = cliHost;
      return cachedHostname;
    }
    throw new Error('CLI authentication succeeded but hostname was not cached');
  } else {
    cachedHostname = getHostUrl();
    return cachedHostname;
  }
}

// Helper to parse the endpoint response
function parseEndpointResponse(response: unknown): {
  company: string | null;
  status: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
  confidence: string;
  confidencePercent: number;
  rationale: string | null;
} {
  let company: string | null = null;
  let status: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let sentimentScore = 0.5;
  let confidence = 'medium';
  let confidencePercent = 70;
  let rationale: string | null = null;

  if (typeof response === 'object' && response !== null) {
    let data = response as Record<string, unknown>;

    // Unwrap output array (agent response format)
    if (
      'output' in data &&
      Array.isArray(data.output) &&
      data.output.length > 0
    ) {
      const message = data.output[0] as Record<string, unknown>;
      if ('content' in message && Array.isArray(message.content)) {
        for (const contentItem of message.content) {
          const item = contentItem as Record<string, unknown>;
          if (item.type === 'output_text' && typeof item.text === 'string') {
            try {
              data = JSON.parse(item.text) as Record<string, unknown>;
              break;
            } catch {
              // Keep original data
            }
          }
        }
      }
    }

    // Extract company
    if ('company' in data && typeof data.company === 'string') {
      company = data.company;
    }

    // Extract sentiment_analysis fields
    if (
      'sentiment_analysis' in data &&
      typeof data.sentiment_analysis === 'object' &&
      data.sentiment_analysis !== null
    ) {
      const sentimentData = data.sentiment_analysis as Record<string, unknown>;

      if (
        'status' in sentimentData &&
        typeof sentimentData.status === 'string'
      ) {
        const s = sentimentData.status.toLowerCase();
        if (s.includes('bull') || s.includes('positive')) status = 'bullish';
        else if (s.includes('bear') || s.includes('negative'))
          status = 'bearish';
        else status = 'neutral';
      }

      if ('confidence' in sentimentData) {
        confidence = String(sentimentData.confidence).toLowerCase();
        if (confidence === 'high') confidencePercent = 90;
        else if (confidence === 'medium') confidencePercent = 70;
        else if (confidence === 'low') confidencePercent = 50;
      }

      if (
        'sentiment_score' in sentimentData &&
        typeof sentimentData.sentiment_score === 'number'
      ) {
        sentimentScore = sentimentData.sentiment_score;
      }

      if (
        'rationale' in sentimentData &&
        typeof sentimentData.rationale === 'string'
      ) {
        rationale = sentimentData.rationale;
      }
    }
  }

  return {
    company,
    status,
    sentimentScore,
    confidence,
    confidencePercent,
    rationale,
  };
}

// Get sentiment endpoint name
sentimentRouter.get('/config', (_req: Request, res: Response) => {
  const endpointName = process.env.DATABRICKS_SENTIMENT_ENDPOINT;
  res.json({
    endpointName: endpointName || null,
    available: !!endpointName,
  });
});

// Get sentiment analysis history for current user
sentimentRouter.get(
  '/history',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const limit = Number.parseInt(req.query.limit as string) || 50;
      const analyses = await getSentimentAnalysesByUserId({ userId, limit });

      res.json({ analyses });
    } catch (error) {
      console.error('[Sentiment] Error getting history:', error);
      res.status(500).json({ error: 'Failed to get sentiment history' });
    }
  },
);

// Clear sentiment analysis history for current user
sentimentRouter.delete(
  '/history',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      await clearSentimentAnalysesByUserId({ userId });
      res.json({ success: true });
    } catch (error) {
      console.error('[Sentiment] Error clearing history:', error);
      res.status(500).json({ error: 'Failed to clear sentiment history' });
    }
  },
);

// Delete a single sentiment analysis by ID
sentimentRouter.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.session?.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!id) {
        return res.status(400).json({ error: 'Analysis ID is required' });
      }

      const deleted = await deleteSentimentAnalysis({ id });
      if (!deleted) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[Sentiment] Error deleting analysis:', error);
      res.status(500).json({ error: 'Failed to delete sentiment analysis' });
    }
  },
);

// Analyze news headline
sentimentRouter.post(
  '/analyze',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { headline } = req.body;
      const userId = req.session?.user?.id;

      if (!headline) {
        return res.status(400).json({ error: 'Headline is required' });
      }

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const endpointName = process.env.DATABRICKS_SENTIMENT_ENDPOINT;
      console.log('[Sentiment] Endpoint name:', endpointName);

      if (!endpointName) {
        console.error('[Sentiment] DATABRICKS_SENTIMENT_ENDPOINT not set');
        return res
          .status(500)
          .json({ error: 'Sentiment endpoint not configured' });
      }

      // Get auth token using the same mechanism as chat
      let token: string;
      try {
        if (process.env.DATABRICKS_TOKEN) {
          console.log('[Sentiment] Using DATABRICKS_TOKEN env var');
          token = process.env.DATABRICKS_TOKEN;
        } else {
          console.log('[Sentiment] Getting token via getDatabricksToken()');
          token = await getDatabricksToken();
          console.log('[Sentiment] Token obtained successfully');
        }
      } catch (error) {
        console.error('[Sentiment] Failed to get Databricks token:', error);
        return res.status(401).json({ error: 'Authentication failed' });
      }

      // Get workspace hostname
      let hostname: string;
      try {
        hostname = await getWorkspaceHostname();
        console.log('[Sentiment] Hostname:', hostname);
      } catch (error) {
        console.error('[Sentiment] Failed to get workspace hostname:', error);
        return res.status(500).json({ error: 'Failed to determine workspace' });
      }

      // Call the Databricks serving endpoint
      const url = `${hostname}/serving-endpoints/${endpointName}/invocations`;
      console.log('[Sentiment] Calling URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          input: [
            {
              role: 'user',
              content: headline,
            },
          ],
        }),
      });

      console.log('[Sentiment] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          '[Sentiment] Endpoint error:',
          response.status,
          errorText,
        );
        return res
          .status(response.status)
          .json({ error: 'Failed to analyze headline' });
      }

      const result = await response.json();
      console.log('[Sentiment] Success, result received');
      console.log('[Sentiment] Raw response:', JSON.stringify(result, null, 2));

      // Parse the response and save to database
      const parsed = parseEndpointResponse(result);

      // Save to database and sector intelligence in parallel
      const sectorId = classifySector(headline);
      const [savedAnalysis] = await Promise.all([
        saveSentimentAnalysis({
          userId,
          headline,
          company: parsed.company,
          status: parsed.status,
          sentimentScore: parsed.sentimentScore,
          confidence: parsed.confidence,
          confidencePercent: parsed.confidencePercent,
          rationale: parsed.rationale,
        }),
        sectorId
          ? saveSectorNewsItem({
              sectorId,
              headline,
              source: 'user-analysis',
              relatedSymbols: parsed.company ? [parsed.company] : [],
              sentimentStatus: parsed.status,
              sentimentScore: parsed.sentimentScore,
              confidence: parsed.confidence,
              confidencePercent: parsed.confidencePercent,
              impactScore: computeImpactScore(
                parsed.sentimentScore,
                parsed.confidencePercent,
              ),
              rationale: parsed.rationale,
              analyzedAt: new Date(),
            })
          : Promise.resolve(null),
      ]);

      // Return both the raw response and the saved analysis ID
      res.json({
        ...result,
        savedId: savedAnalysis?.id || null,
      });
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
