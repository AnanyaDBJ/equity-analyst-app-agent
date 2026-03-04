import { motion } from 'framer-motion';
import React, { memo, useState } from 'react';
import { AnimatedAssistantIcon } from './animation-assistant-icon';
import { Response } from './elements/response';
import { MessageContent } from './elements/message';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  type ToolState,
} from './elements/tool';
import {
  McpTool,
  McpToolHeader,
  McpToolContent,
  McpToolInput,
  McpApprovalActions,
} from './elements/mcp-tool';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { MessageEditor } from './message-editor';
import { MessageReasoning } from './message-reasoning';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@chat-template/core';
import { useDataStream } from './data-stream-provider';
import {
  createMessagePartSegments,
  formatNamePart,
  isNamePart,
  joinMessagePartSegments,
} from './databricks-message-part-transformers';
import { MessageError } from './message-error';
import { MessageOAuthError } from './message-oauth-error';
import { isCredentialErrorMessage } from '@/lib/oauth-error-utils';
import { Streamdown } from 'streamdown';
// Databricks metadata is now accessed directly from part.callProviderMetadata?.databricks
import { useApproval } from '@/hooks/use-approval';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  LoaderIcon,
  CandlestickChartIcon,
  CompassIcon,
  LayersIcon,
  SparklesIcon,
} from 'lucide-react';

// Custom SVG icons for unique look
const StockPulseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h4l3-9 4 18 3-9h4" />
  </svg>
);

const WebRadarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
  </svg>
);

const VectorGridIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="5" r="2" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
    <circle cx="12" cy="12" r="3" />
    <line x1="7" y1="5" x2="9" y2="10" />
    <line x1="17" y1="5" x2="15" y2="10" />
    <line x1="7" y1="19" x2="9" y2="14" />
    <line x1="17" y1="19" x2="15" y2="14" />
  </svg>
);

// Tool type configuration for icons and display names
const _TOOL_CONFIG: Record<string, { icon: React.ReactNode; displayName: string }> = {
  // AlphaVantage MCP server - stock/finance data (pulse/heartbeat style)
  alphavantage: {
    icon: <StockPulseIcon className="size-4" />,
    displayName: 'Stock Data',
  },
  stock: {
    icon: <StockPulseIcon className="size-4" />,
    displayName: 'Stock Data',
  },
  finance: {
    icon: <CandlestickChartIcon className="size-4" />,
    displayName: 'Finance',
  },
  // Web search tool (radar/compass style)
  web_search: {
    icon: <WebRadarIcon className="size-4" />,
    displayName: 'Web Search',
  },
  search: {
    icon: <CompassIcon className="size-4" />,
    displayName: 'Search',
  },
  // Databricks Vector Search (connected nodes style)
  vector_search: {
    icon: <VectorGridIcon className="size-4" />,
    displayName: 'Vector Search',
  },
  databricks: {
    icon: <LayersIcon className="size-4" />,
    displayName: 'Databricks',
  },
  // Default (sparkles for AI tools)
  default: {
    icon: <SparklesIcon className="size-4" />,
    displayName: 'Tool',
  },
};

// Helper to extract clean tool name from Databricks agent tool names
// e.g., "ananyaroy__agents__web_search_tool" → "Web Search"
const formatToolName = (rawName: string): string => {
  if (!rawName) return 'Tool';

  const nameLower = rawName.toLowerCase();

  // Check for known tool types first
  if (nameLower.includes('alphavantage') || nameLower.includes('alpha_vantage')) {
    return 'AlphaVantage';
  }
  if (nameLower.includes('vector_search') || nameLower.includes('vectorsearch')) {
    return 'Vector Search';
  }
  if (nameLower.includes('web_search') || nameLower.includes('websearch')) {
    return 'Web Search';
  }

  // Extract the last part after __
  const parts = rawName.split('__');
  const toolPart = parts[parts.length - 1] || rawName;
  // Convert snake_case to Title Case and remove "tool" suffix
  return toolPart
    .replace(/_tool$/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// Get appropriate icon for tool type
const getToolIcon = (toolName: string): React.ReactNode => {
  const name = toolName.toLowerCase();

  // AlphaVantage / Stock / Finance tools - pulse line icon
  if (name.includes('alphavantage') || name.includes('alpha_vantage') ||
      name.includes('stock') || name.includes('finance') || name.includes('quote')) {
    return <StockPulseIcon className="size-4" />;
  }

  // Web search tools - radar icon
  if (name.includes('web_search') || name.includes('websearch')) {
    return <WebRadarIcon className="size-4" />;
  }

  // General search - compass icon
  if (name.includes('search')) {
    return <CompassIcon className="size-4" />;
  }

  // Vector search / Databricks tools - connected grid icon
  if (name.includes('vector') || name.includes('databricks') ||
      name.includes('retrieval') || name.includes('embedding')) {
    return <VectorGridIcon className="size-4" />;
  }

  // Default - sparkles for AI tools
  return <SparklesIcon className="size-4" />;
};

// Extract a brief summary from tool result
const extractResultSummary = (result: unknown): string => {
  if (!result) return 'Completed';

  try {
    let data = result;
    // If result is a string, try to parse it
    if (typeof result === 'string') {
      // Check if it's a JSON array of objects
      if (result.startsWith('[{')) {
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0];
          if (first.text) {
            // This is likely OTEL format, try to extract from the text
            try {
              const innerData = JSON.parse(first.text);
              if (innerData.rows && Array.isArray(innerData.rows)) {
                return `Found ${innerData.rows.length} result(s)`;
              }
              if (innerData.immersive_products && Array.isArray(innerData.immersive_products)) {
                return `Found ${innerData.immersive_products.length} products`;
              }
              if (innerData.organic_results && Array.isArray(innerData.organic_results)) {
                return `Found ${innerData.organic_results.length} results`;
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
        return `Found ${parsed.length} result(s)`;
      }
      data = JSON.parse(result);
    }

    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      // Check for common result patterns
      if (obj.immersive_products && Array.isArray(obj.immersive_products)) {
        return `Found ${obj.immersive_products.length} products`;
      }
      if (obj.organic_results && Array.isArray(obj.organic_results)) {
        return `Found ${obj.organic_results.length} results`;
      }
      if (obj.results && Array.isArray(obj.results)) {
        return `Found ${obj.results.length} results`;
      }
      if (obj.rows && Array.isArray(obj.rows)) {
        return `Found ${obj.rows.length} rows`;
      }
      if (obj.total_results) {
        return `Found ${obj.total_results} results`;
      }
    }

    if (Array.isArray(data)) {
      return `Found ${data.length} result(s)`;
    }
  } catch {
    // If parsing fails, just return completed
  }

  return 'Completed';
};

// Helper to format tool output for display
const formatToolResultForDisplay = (result: unknown): React.ReactNode => {
  if (!result) return null;

  try {
    let data = result;

    // Parse if string
    if (typeof result === 'string') {
      // Handle OTEL format: [{"type": "text", "text": "{...}"}]
      if (result.startsWith('[{')) {
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
          try {
            data = JSON.parse(parsed[0].text);
          } catch {
            data = parsed;
          }
        } else {
          data = parsed;
        }
      } else if (result.startsWith('{')) {
        data = JSON.parse(result);
      } else {
        return <span className="text-sm">{result}</span>;
      }
    }

    // Extract key information from search results
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;

      // Handle search results with products
      if (obj.immersive_products && Array.isArray(obj.immersive_products)) {
        const products = obj.immersive_products.slice(0, 5);
        return (
          <div className="space-y-2">
            {products.map((p: Record<string, unknown>, i: number) => (
              <div key={`product-${i}`} className="flex items-center gap-2 rounded bg-background/50 p-2 text-sm">
                <span className="font-medium">{p.title as string}</span>
                {p.price && <span className="text-primary">{p.price as string}</span>}
              </div>
            ))}
            {obj.immersive_products.length > 5 && (
              <span className='text-muted-foreground text-xs'>+{obj.immersive_products.length - 5} more results</span>
            )}
          </div>
        );
      }

      // Handle organic search results
      if (obj.organic_results && Array.isArray(obj.organic_results)) {
        const results = obj.organic_results.slice(0, 3);
        return (
          <div className="space-y-2">
            {results.map((r: Record<string, unknown>, i: number) => (
              <div key={`result-${i}`} className="rounded bg-background/50 p-2 text-sm">
                <div className="font-medium">{r.title as string}</div>
                {r.snippet && <div className='line-clamp-2 text-muted-foreground text-xs'>{r.snippet as string}</div>}
              </div>
            ))}
          </div>
        );
      }

      // Handle rows/table data
      if (obj.rows && Array.isArray(obj.rows)) {
        return (
          <div className="text-sm">
            <span className="text-muted-foreground">Retrieved {obj.rows.length} rows</span>
          </div>
        );
      }
    }

    // Fallback: show truncated JSON
    const jsonStr = JSON.stringify(data, null, 2);
    if (jsonStr.length > 500) {
      return (
        <pre className="max-h-40 overflow-auto rounded bg-background/50 p-2 text-xs">
          {jsonStr.slice(0, 500)}...
        </pre>
      );
    }
    return (
      <pre className="max-h-40 overflow-auto rounded bg-background/50 p-2 text-xs">
        {jsonStr}
      </pre>
    );
  } catch {
    return <span className='text-muted-foreground text-sm'>Result available</span>;
  }
};

// Component to render Databricks agent tool calls
const AgentToolCard = ({
  toolName,
  args,
  result,
  isComplete,
}: {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  isComplete: boolean;
}) => {
  const displayName = formatToolName(toolName);
  const icon = getToolIcon(toolName);
  const summary = isComplete ? extractResultSummary(result) : 'Running...';

  // Extract the query or main argument for display
  // Support various argument names used by different tools
  const query = args?.user_query || args?.query || args?.search_query ||
                args?.symbol || args?.ticker || args?.input || args?.question || '';

  return (
    <Collapsible defaultOpen={false} className="not-prose w-full overflow-hidden rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm">
      <CollapsibleTrigger className='group flex w-full items-center justify-between gap-3 px-4 py-3 transition-all hover:bg-accent/5'>
        {/* Left side: Icon + Tool Name + Query */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Tool Icon with subtle background */}
          <div className={cn(
            "flex shrink-0 items-center justify-center rounded-lg p-2 transition-colors",
            isComplete
              ? "bg-primary/5 text-primary"
              : "bg-muted text-muted-foreground"
          )}>
            {icon}
          </div>

          {/* Tool Name and Query */}
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{displayName}</span>
              {isComplete ? (
                <div className="flex size-4 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircleIcon className="size-3 text-primary" />
                </div>
              ) : (
                <LoaderIcon className="size-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
            {query && (
              <span className='max-w-[300px] truncate text-muted-foreground text-xs'>
                {String(query)}
              </span>
            )}
          </div>
        </div>

        {/* Right side: Summary + Chevron */}
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn(
            'hidden rounded-md px-2 py-1 font-medium text-xs sm:inline-block',
            isComplete
              ? "bg-primary/5 text-primary"
              : "bg-muted text-muted-foreground"
          )}>
            {summary}
          </span>
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className='space-y-3 border-border/50 border-t bg-muted/20 px-4 py-3'>
          {/* Show arguments */}
          <div>
            <div className='mb-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider'>Input</div>
            <div className='rounded-lg bg-background/50 p-2.5 text-sm'>
              {query ? (
                <span className="text-foreground">{String(query)}</span>
              ) : (
                <pre className='overflow-x-auto text-muted-foreground text-xs'>{JSON.stringify(args, null, 2)}</pre>
              )}
            </div>
          </div>
          {/* Show actual result if complete */}
          {isComplete && result && (
            <div>
              <div className='mb-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider'>Output</div>
              <div className='rounded-lg bg-background/50 p-2.5'>
                {formatToolResultForDisplay(result)}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Check if output is a sentiment analysis result
const isSentimentAnalysis = (obj: unknown): obj is {
  news_headline?: string;
  company?: string;
  sentiment_analysis?: { sentiment_score?: number; rationale?: string };
  status?: string;
  confidence?: string;
} => {
  if (typeof obj !== 'object' || obj === null) return false;
  const data = obj as Record<string, unknown>;
  return 'sentiment_analysis' in data || 'status' in data || 'rationale' in data;
};

// Render sentiment analysis in a nice card format
const SentimentAnalysisCard = ({ data }: { data: Record<string, unknown> }) => {
  const _headline = data.news_headline as string | undefined;
  const company = data.company as string | undefined;
  const sentimentAnalysis = data.sentiment_analysis as { sentiment_score?: number; rationale?: string } | undefined;
  const status = (data.status as string | undefined)?.toLowerCase();
  const confidence = data.confidence as string | undefined;

  const sentimentScore = sentimentAnalysis?.sentiment_score;
  const rationale = sentimentAnalysis?.rationale;

  const getStatusColor = (s: string | undefined) => {
    if (s === 'bullish' || s === 'positive') return 'text-green-400 bg-green-400/10 border-green-400/30';
    if (s === 'bearish' || s === 'negative') return 'text-red-400 bg-red-400/10 border-red-400/30';
    return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
  };

  const getStatusIcon = (s: string | undefined) => {
    if (s === 'bullish' || s === 'positive') return '↑';
    if (s === 'bearish' || s === 'negative') return '↓';
    return '→';
  };

  return (
    <div className="space-y-3 p-3">
      {/* Status Badge */}
      {status && (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium text-sm capitalize ${getStatusColor(status)}`}>
            <span>{getStatusIcon(status)}</span>
            {status}
          </span>
          {confidence && (
            <span className='text-muted-foreground text-xs'>
              Confidence: <span className="font-medium capitalize">{confidence}</span>
            </span>
          )}
        </div>
      )}

      {/* Score */}
      {sentimentScore !== undefined && (
        <div className="flex items-center gap-2">
          <span className='text-muted-foreground text-sm'>Sentiment Score:</span>
          <span className="font-semibold">{(sentimentScore * 100).toFixed(0)}%</span>
          <div className='h-2 max-w-32 flex-1 overflow-hidden rounded-full bg-muted'>
            <div
              className={`h-full rounded-full ${sentimentScore > 0.6 ? 'bg-green-500' : sentimentScore < 0.4 ? 'bg-red-500' : 'bg-yellow-500'}`}
              style={{ width: `${sentimentScore * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Company */}
      {company && (
        <div className="flex items-center gap-2">
          <span className='text-muted-foreground text-sm'>Company:</span>
          <span className='rounded bg-primary/20 px-2 py-0.5 font-medium text-primary text-sm'>{company}</span>
        </div>
      )}

      {/* Rationale */}
      {rationale && (
        <div className="rounded-lg bg-muted/30 p-3">
          <div className='mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide'>Analysis</div>
          <p className="text-sm leading-relaxed">{rationale}</p>
        </div>
      )}
    </div>
  );
};

// Helper to extract text content from deeply nested structures
const extractTextContent = (obj: unknown, depth = 0): string | null => {
  if (depth > 5) return null;

  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed.length > 20 && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return trimmed;
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractTextContent(parsed, depth + 1);
      } catch {
        return trimmed.length > 50 ? trimmed : null;
      }
    }
    return trimmed.length > 10 ? trimmed : null;
  }

  if (typeof obj !== 'object' || obj === null) return null;

  const priorityFields = ['text', 'content', 'message', 'result', 'response', 'answer', 'output', 'body', 'description'];

  for (const field of priorityFields) {
    if (field in obj) {
      const result = extractTextContent((obj as Record<string, unknown>)[field], depth + 1);
      if (result) return result;
    }
  }

  for (const value of Object.values(obj)) {
    const result = extractTextContent(value, depth + 1);
    if (result) return result;
  }

  return null;
};

// Helper to format tool output nicely
const _formatToolOutput = (output: unknown): React.ReactNode => {
  if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output);
      return _formatToolOutput(parsed);
    } catch {
      const trimmed = output.trim();
      if (trimmed.length > 0) {
        return <div className="whitespace-pre-wrap p-2 leading-relaxed">{trimmed}</div>;
      }
      return (
        <div className="p-2 text-muted-foreground text-sm italic">
          Tool executed successfully
        </div>
      );
    }
  }

  if (typeof output === 'object' && output !== null) {
    // Check for sentiment analysis format
    if (isSentimentAnalysis(output)) {
      return <SentimentAnalysisCard data={output as Record<string, unknown>} />;
    }

    // Try to extract readable content
    const extractedText = extractTextContent(output);
    if (extractedText) {
      return (
        <div className="p-2">
          <div className="whitespace-pre-wrap leading-relaxed">{extractedText}</div>
        </div>
      );
    }

    if (Array.isArray(output)) {
      if (output.length === 0) {
        return <div className="p-2 text-muted-foreground">No results</div>;
      }

      const extractedItems = output
        .map(item => extractTextContent(item))
        .filter((text): text is string => text !== null);

      if (extractedItems.length > 0) {
        return (
          <div className="space-y-3 p-2">
            {extractedItems.map((text, index) => (
              <div key={`${text.slice(0, 50)}-${index}`} className='border-primary/50 border-l-2 pl-3'>
                <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
              </div>
            ))}
          </div>
        );
      }
    }

    return (
      <div className="p-2 text-muted-foreground text-sm italic">
        Tool executed successfully
      </div>
    );
  }

  const strVal = String(output);
  if (strVal && strVal !== 'undefined' && strVal !== 'null') {
    return <div className="p-2">{strVal}</div>;
  }

  return (
    <div className="p-2 text-muted-foreground text-sm italic">
      Tool executed successfully
    </div>
  );
};

const PurePreviewMessage = ({
  message,
  allMessages,
  isLoading,
  setMessages,
  addToolApprovalResponse,
  sendMessage,
  regenerate,
  isReadonly,
  requiresScrollPadding,
}: {
  chatId: string;
  message: ChatMessage;
  allMessages: ChatMessage[];
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  addToolApprovalResponse: UseChatHelpers<ChatMessage>['addToolApprovalResponse'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [showErrors, setShowErrors] = useState(false);

  // Hook for handling MCP approval requests
  const { submitApproval, isSubmitting, pendingApprovalId } = useApproval({
    addToolApprovalResponse,
    sendMessage,
  });

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === 'file',
  );

  // Extract non-OAuth error parts separately (OAuth errors are rendered inline)
  const errorParts = React.useMemo(
    () =>
      message.parts
        .filter((part) => part.type === 'data-error')
        .filter((part) => {
          // OAuth errors are rendered inline, not in the error section
          return !isCredentialErrorMessage(part.data);
        }),
    [message.parts],
  );

  useDataStream();

  const partSegments = React.useMemo(
    /**
     * We segment message parts into segments that can be rendered as a single component.
     * Used to render citations as part of the associated text.
     * Note: OAuth errors are included here for inline rendering, non-OAuth errors are filtered out.
     */
    () =>
      createMessagePartSegments(
        message.parts.filter(
          (part) =>
            part.type !== 'data-error' || isCredentialErrorMessage(part.data),
        ),
      ),
    [message.parts],
  );

  // Check if message only contains non-OAuth errors (no other content)
  const hasOnlyErrors = React.useMemo(() => {
    const nonErrorParts = message.parts.filter(
      (part) => part.type !== 'data-error',
    );
    // Only consider non-OAuth errors for this check
    return errorParts.length > 0 && nonErrorParts.length === 0;
  }, [message.parts, errorParts.length]);

  return (
    <div
      data-testid={`message-${message.role}`}
      className="group/message w-full"
      data-role={message.role}
    >
      <div
        className={cn('flex w-full items-start gap-2 md:gap-3', {
          'justify-end': message.role === 'user',
          'justify-start': message.role === 'assistant',
        })}
      >
        {message.role === 'assistant' && (
          <AnimatedAssistantIcon size={14} isLoading={isLoading} />
        )}

        <div
          className={cn('flex min-w-0 flex-col gap-3', {
            'w-full': message.role === 'assistant' || mode === 'edit',
            'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            'max-w-[70%] sm:max-w-[min(fit-content,80%)]':
              message.role === 'user' && mode !== 'edit',
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              data-testid={`message-attachments`}
              className="flex flex-row justify-end gap-2"
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={{
                    name: attachment.filename ?? 'file',
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                />
              ))}
            </div>
          )}

          {partSegments?.map((parts, index) => {
            const [part] = parts;
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            if (type === 'reasoning' && part.text?.trim().length > 0) {
              return (
                <MessageReasoning
                  key={key}
                  isLoading={isLoading}
                  reasoning={part.text}
                />
              );
            }

            if (type === 'text') {
              if (isNamePart(part)) {
                return (
                  <Streamdown
                    key={key}
                    className="-mb-2 mt-0 border-l-4 pl-2 text-muted-foreground"
                  >{`# ${formatNamePart(part)}`}</Streamdown>
                );
              }
              if (mode === 'view') {
                return (
                  <div key={key}>
                    <MessageContent
                      data-testid="message-content"
                      className={cn({
                        'w-fit break-words rounded-2xl px-3 py-2 text-right text-white':
                          message.role === 'user',
                        'bg-transparent px-0 py-0 text-left':
                          message.role === 'assistant',
                      })}
                      style={
                        message.role === 'user'
                          ? { backgroundColor: '#006cff' }
                          : undefined
                      }
                    >
                      <Response>
                        {sanitizeText(joinMessagePartSegments(parts))}
                      </Response>
                    </MessageContent>
                  </div>
                );
              }

              if (mode === 'edit') {
                return (
                  <div
                    key={key}
                    className="flex w-full flex-row items-start gap-3"
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        regenerate={regenerate}
                      />
                    </div>
                  </div>
                );
              }
            }

            // Render Databricks tool calls and results
            if (part.type === `dynamic-tool`) {
              const { toolCallId, input, state, errorText, output, toolName } = part;

              // Check if this is an MCP tool call by looking for approvalRequestId in metadata
              // This works across all states (approval-requested, approval-denied, output-available)
              const isMcpApproval = part.callProviderMetadata?.databricks?.approvalRequestId != null;
              const mcpServerName = part.callProviderMetadata?.databricks?.mcpServerName?.toString();

              // Extract approval outcome for 'approval-responded' state
              // When addToolApprovalResponse is called, AI SDK sets the `approval` property
              // on the tool-call part and changes state to 'approval-responded'
              const approved: boolean | undefined =
                'approval' in part ? part.approval?.approved : undefined;


              // When approved but only have approval status (not actual output), show as input-available
              const effectiveState: ToolState = (() => {
                  if (part.providerExecuted && !isLoading && state === 'input-available') {
                    return 'output-available'
                  }
                return state;
              })()

              // Render MCP tool calls with special styling
              if (isMcpApproval) {
                // Extract summary for collapsed header
                const mcpSummary = effectiveState === 'output-available'
                  ? extractResultSummary(output)
                  : effectiveState === 'input-available' ? 'Running...' : 'Pending';

                return (
                  <McpTool key={toolCallId} defaultOpen={false}>
                    <McpToolHeader
                      serverName={mcpServerName}
                      toolName={toolName}
                      state={effectiveState}
                      approved={approved}
                      summary={mcpSummary}
                    />
                    <McpToolContent>
                      <McpToolInput input={input} />
                      {state === 'approval-requested' && (
                        <McpApprovalActions
                          onApprove={() =>
                            submitApproval({
                              approvalRequestId: toolCallId,
                              approve: true,
                            })
                          }
                          onDeny={() =>
                            submitApproval({
                              approvalRequestId: toolCallId,
                              approve: false,
                            })
                          }
                          isSubmitting={
                            isSubmitting && pendingApprovalId === toolCallId
                          }
                        />
                      )}
                      {state === 'output-available' && output != null && (
                        <ToolOutput
                          output={
                            errorText ? (
                              <div className="rounded border p-2 text-red-500">
                                Error: {errorText}
                              </div>
                            ) : (
                              formatToolResultForDisplay(output)
                            )
                          }
                          errorText={undefined}
                        />
                      )}
                    </McpToolContent>
                  </McpTool>
                );
              }

              // Render regular tool calls - collapsed by default with summary
              const toolSummary = effectiveState === 'output-available'
                ? extractResultSummary(output)
                : effectiveState === 'input-available' ? 'Running...' : 'Pending';

              return (
                <Tool key={toolCallId} defaultOpen={false}>
                  <ToolHeader
                    type={formatToolName(toolName)}
                    state={effectiveState}
                    summary={toolSummary}
                  />
                  <ToolContent>
                    <ToolInput input={input} />
                    {state === 'output-available' && (
                      <ToolOutput
                        output={
                          errorText ? (
                            <div className="rounded border p-2 text-red-500">
                              Error: {errorText}
                            </div>
                          ) : (
                            formatToolResultForDisplay(output)
                          )
                        }
                        errorText={undefined}
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            // Render Databricks Agent tool invocations (from OTEL format)
            if (type === 'tool-invocation') {
              const { toolName, toolCallId, args } = part as {
                toolName: string;
                toolCallId: string;
                args: Record<string, unknown>;
              };

              // Find the matching tool-result in all parts
              const allParts = message.parts as Array<Record<string, unknown>>;
              const resultPart = allParts.find(
                (p) => p.type === 'tool-result' && p.toolCallId === toolCallId
              );

              return (
                <AgentToolCard
                  key={key}
                  toolName={toolName}
                  args={args || {}}
                  result={resultPart?.result}
                  isComplete={!!resultPart}
                />
              );
            }

            // Skip tool-result parts (they're rendered with their invocation)
            if (type === 'tool-result') {
              return null;
            }

            // Support for citations/annotations
            if (type === 'source-url') {
              return (
                <a
                  key={key}
                  href={part.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-baseline text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <sup className="text-xs">[{part.title || part.url}]</sup>
                </a>
              );
            }

            // Render OAuth errors inline
            if (type === 'data-error' && isCredentialErrorMessage(part.data)) {
              return (
                <MessageOAuthError
                  key={key}
                  error={part.data}
                  allMessages={allMessages}
                  setMessages={setMessages}
                  sendMessage={sendMessage}
                />
              );
            }
          })}

          {!isReadonly && !hasOnlyErrors && (
            <MessageActions
              key={`action-${message.id}`}
              message={message}
              isLoading={isLoading}
              setMode={setMode}
              errorCount={errorParts.length}
              showErrors={showErrors}
              onToggleErrors={() => setShowErrors(!showErrors)}
            />
          )}

          {errorParts.length > 0 && (hasOnlyErrors || showErrors) && (
            <div className="flex flex-col gap-2">
              {errorParts.map((part, index) => (
                <MessageError
                  key={`error-${message.id}-${index}`}
                  error={part.data}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;

    return false;
  },
);

export const AwaitingResponseMessage = () => {
  const role = 'assistant';

  return (
    <div
      data-testid="message-assistant-loading"
      className="group/message w-full"
      data-role={role}
    >
      <div className="flex items-start justify-start gap-3">
        <AnimatedAssistantIcon size={14} isLoading={false} muted={true} />

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="p-0 text-muted-foreground text-sm">
            <LoadingText>Thinking...</LoadingText>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingText = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      animate={{ backgroundPosition: ['100% 50%', '-100% 50%'] }}
      transition={{
        duration: 1.5,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'linear',
      }}
      style={{
        background:
          'linear-gradient(90deg, hsl(var(--muted-foreground)) 0%, hsl(var(--muted-foreground)) 35%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground)) 65%, hsl(var(--muted-foreground)) 100%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
      }}
      className="flex items-center text-transparent"
    >
      {children}
    </motion.div>
  );
};
