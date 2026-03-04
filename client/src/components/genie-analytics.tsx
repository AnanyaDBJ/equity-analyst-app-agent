import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  Table,
  Sparkles,
  MessageSquareText,
  Code,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts';

interface GenieColumn {
  name: string;
  type: string;
}

interface GenieTable {
  columns: GenieColumn[];
  rows: string[][];
  rowCount: number;
}

interface GenieEntry {
  id: string;
  question: string;
  answer?: string;
  sql?: string;
  table?: GenieTable;
  suggestedQuestions?: string[];
  isLoading: boolean;
  error?: string;
}

interface GenieResponse {
  conversationId: string;
  messageId: string;
  answer: string;
  sql?: string;
  table?: GenieTable;
  suggestedQuestions?: string[];
}

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

const PNL_GREEN = '#22c55e';
const PNL_RED = '#ef4444';

// Detect if a column name relates to currency/P&L
function isCurrencyColumn(name: string): boolean {
  const lower = name.toLowerCase();
  return /pnl|revenue|cost|amount|usd|price|notional|wallet/.test(lower);
}

function isBpsColumn(name: string): boolean {
  return /bps|spread/.test(name.toLowerCase());
}

function isPercentColumn(name: string): boolean {
  return /percent|pct|rate|ratio|penetration/.test(name.toLowerCase());
}

function isPnlColumn(name: string): boolean {
  return /pnl|profit|loss|edge/.test(name.toLowerCase());
}

// Format numbers based on column context
function formatValue(val: number, colName: string): string {
  if (isCurrencyColumn(colName)) {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (isBpsColumn(colName)) return `${val.toFixed(1)} bps`;
  if (isPercentColumn(colName)) {
    // If value looks like a ratio (0-1), multiply by 100
    if (Math.abs(val) <= 1) return `${(val * 100).toFixed(1)}%`;
    return `${val.toFixed(1)}%`;
  }
  if (Number.isInteger(val)) return val.toLocaleString();
  return val.toFixed(2);
}

// Determine cell text color for P&L values
function pnlColor(val: number): string {
  if (val > 0) return 'text-green-400';
  if (val < 0) return 'text-red-400';
  return 'text-white/80';
}

type ChartType = 'bar' | 'pie' | 'area' | 'line' | 'stacked-bar' | 'pnl-bar' | 'none';

function detectChartType(table: GenieTable): ChartType {
  if (!table || table.rows.length === 0 || table.columns.length < 2) return 'none';
  if (table.rows.length > 30) return 'none';

  const col0Name = table.columns[0].name.toLowerCase();
  const col0Type = table.columns[0].type.toUpperCase();

  const numericCols = table.columns.slice(1).filter((c) => {
    const t = c.type.toUpperCase();
    return ['INT', 'LONG', 'BIGINT', 'DOUBLE', 'FLOAT', 'DECIMAL', 'SHORT'].some((nt) => t.includes(nt));
  });

  if (numericCols.length === 0) return 'none';

  const isDateCol = ['DATE', 'TIMESTAMP', 'TIME'].some((t) => col0Type.includes(t)) ||
    /date|month|day|week|period/.test(col0Name);

  // P&L bar chart: has P&L-related numeric columns
  const hasPnlCol = numericCols.some((c) => isPnlColumn(c.name));

  // Multi-series time data -> line chart
  if (isDateCol && numericCols.length >= 2) return 'line';

  // Time series with single metric -> area
  if (isDateCol && numericCols.length === 1) return 'area';

  // P&L data -> special colored bar chart
  if (hasPnlCol && !isDateCol) return 'pnl-bar';

  // Multiple numeric cols with categories -> stacked bar
  if (numericCols.length >= 2 && table.rows.length <= 15) return 'stacked-bar';

  // Small category count -> pie
  if (numericCols.length === 1 && table.rows.length <= 6) return 'pie';

  return 'bar';
}

function parseNumeric(val: string | null): number {
  if (val === null || val === '') return 0;
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
}

// Enhanced custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/20 bg-gray-900/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="mb-1 text-white/70 text-xs">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="font-medium text-sm" style={{ color: entry.color || entry.fill }}>
          {entry.name}: {formatValue(entry.value, entry.name)}
        </p>
      ))}
    </div>
  );
}

function GenieChart({ table }: { table: GenieTable }) {
  const chartType = detectChartType(table);
  if (chartType === 'none') return null;

  const labelKey = table.columns[0].name;
  const numericCols = table.columns.slice(1).filter((c) => {
    const t = c.type.toUpperCase();
    return ['INT', 'LONG', 'BIGINT', 'DOUBLE', 'FLOAT', 'DECIMAL', 'SHORT'].some((nt) => t.includes(nt));
  });

  const data = table.rows.map((row) => {
    const obj: Record<string, string | number> = {};
    obj[labelKey] = row[0] ?? '';
    for (const col of numericCols) {
      const idx = table.columns.findIndex((c) => c.name === col.name);
      obj[col.name] = parseNumeric(row[idx]);
    }
    return obj;
  });

  if (chartType === 'pie') {
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey={numericCols[0].name}
              nameKey={labelKey}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={2}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <RechartsTooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === 'area') {
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              {numericCols.map((col, i) => (
                <linearGradient key={col.name} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[i]} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={CHART_COLORS[i]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey={labelKey} tick={{ fill: '#999', fontSize: 11 }} />
            <YAxis tick={{ fill: '#999', fontSize: 11 }} tickFormatter={(v) => formatValue(v, numericCols[0].name)} />
            <RechartsTooltip content={<CustomTooltip />} />
            {numericCols.map((col, i) => (
              <Area
                key={col.name}
                type="monotone"
                dataKey={col.name}
                fill={`url(#grad-${i})`}
                stroke={CHART_COLORS[i]}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === 'line') {
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey={labelKey} tick={{ fill: '#999', fontSize: 11 }} />
            <YAxis tick={{ fill: '#999', fontSize: 11 }} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend />
            {numericCols.map((col, i) => (
              <Line
                key={col.name}
                type="monotone"
                dataKey={col.name}
                stroke={CHART_COLORS[i]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === 'pnl-bar') {
    // Color bars green/red based on value
    const pnlCol = numericCols.find((c) => isPnlColumn(c.name)) || numericCols[0];
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data} layout={data.length > 8 ? 'vertical' : 'horizontal'}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            {data.length > 8 ? (
              <>
                <YAxis dataKey={labelKey} type="category" tick={{ fill: '#999', fontSize: 11 }} width={120} />
                <XAxis type="number" tick={{ fill: '#999', fontSize: 11 }} tickFormatter={(v) => formatValue(v, pnlCol.name)} />
              </>
            ) : (
              <>
                <XAxis dataKey={labelKey} tick={{ fill: '#999', fontSize: 11 }} />
                <YAxis tick={{ fill: '#999', fontSize: 11 }} tickFormatter={(v) => formatValue(v, pnlCol.name)} />
              </>
            )}
            <RechartsTooltip content={<CustomTooltip />} />
            <Bar dataKey={pnlCol.name} radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={(entry[pnlCol.name] as number) >= 0 ? PNL_GREEN : PNL_RED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === 'stacked-bar') {
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data} layout={data.length > 8 ? 'vertical' : 'horizontal'}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            {data.length > 8 ? (
              <>
                <YAxis dataKey={labelKey} type="category" tick={{ fill: '#999', fontSize: 11 }} width={120} />
                <XAxis type="number" tick={{ fill: '#999', fontSize: 11 }} />
              </>
            ) : (
              <>
                <XAxis dataKey={labelKey} tick={{ fill: '#999', fontSize: 11 }} />
                <YAxis tick={{ fill: '#999', fontSize: 11 }} />
              </>
            )}
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend />
            {numericCols.map((col, i) => (
              <Bar key={col.name} dataKey={col.name} stackId="a" fill={CHART_COLORS[i]} radius={i === numericCols.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default bar chart
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout={data.length > 8 ? 'vertical' : 'horizontal'}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          {data.length > 8 ? (
            <>
              <YAxis dataKey={labelKey} type="category" tick={{ fill: '#999', fontSize: 11 }} width={120} />
              <XAxis type="number" tick={{ fill: '#999', fontSize: 11 }} />
            </>
          ) : (
            <>
              <XAxis dataKey={labelKey} tick={{ fill: '#999', fontSize: 11 }} />
              <YAxis tick={{ fill: '#999', fontSize: 11 }} />
            </>
          )}
          <RechartsTooltip content={<CustomTooltip />} />
          {numericCols.length > 1 && <Legend />}
          {numericCols.map((col, i) => (
            <Bar key={col.name} dataKey={col.name} fill={CHART_COLORS[i]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GenieTableView({ table }: { table: GenieTable }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-white/10 border-b bg-white/5">
            {table.columns.map((col) => (
              <th key={col.name} className="px-4 py-2.5 text-left font-medium text-white/70">
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} className="border-white/5 border-b hover:bg-white/5">
              {row.map((cell, ci) => {
                const colName = table.columns[ci]?.name || '';
                const isNumeric = cell !== null && !Number.isNaN(Number(cell));
                const numVal = isNumeric ? Number(cell) : 0;
                const hasPnl = isPnlColumn(colName);

                return (
                  <td key={ci} className={`max-w-xs truncate px-4 py-2 ${hasPnl && isNumeric ? pnlColor(numVal) : 'text-white/80'}`}>
                    {cell === null ? (
                      <span className="text-white/30">null</span>
                    ) : isNumeric && (isCurrencyColumn(colName) || isBpsColumn(colName) || isPercentColumn(colName)) ? (
                      formatValue(numVal, colName)
                    ) : (
                      cell
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className='flex items-center justify-between px-4 py-2 text-white/40 text-xs'>
        <span>{table.rowCount} row{table.rowCount !== 1 ? 's' : ''}</span>
        {table.rows.some((row) =>
          row.some((cell, ci) => {
            const col = table.columns[ci]?.name || '';
            return cell !== null && !Number.isNaN(Number(cell)) && isPnlColumn(col) && Number(cell) > 0;
          }),
        ) && (
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-green-400"><TrendingUp className="h-3 w-3" /> Positive</span>
            <span className="flex items-center gap-1 text-red-400"><TrendingDown className="h-3 w-3" /> Negative</span>
          </span>
        )}
      </div>
    </div>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className='flex w-full items-center gap-2 px-3 py-2 text-left text-white/50 text-xs transition-colors hover:text-white/70'
      >
        <Code className="h-3.5 w-3.5" />
        <span>Generated SQL</span>
        {open ? <ChevronDown className="ml-auto h-3.5 w-3.5" /> : <ChevronRight className="ml-auto h-3.5 w-3.5" />}
      </button>
      {open && (
        <pre className='overflow-x-auto border-white/10 border-t px-3 py-2 font-mono text-blue-300 text-xs leading-relaxed'>
          {sql}
        </pre>
      )}
    </div>
  );
}

function GenieEntryCard({ entry, onAskFollowUp }: { entry: GenieEntry; onAskFollowUp: (q: string) => void }) {
  return (
    <div className="space-y-3">
      {/* User question */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#FF3621]/20 px-4 py-2.5 text-sm text-white">
          {entry.question}
        </div>
      </div>

      {/* Genie response */}
      {entry.isLoading ? (
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20">
            <Sparkles className="h-4 w-4 animate-pulse text-purple-400" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzing your data...
            </div>
            <div className="h-2 w-48 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      ) : entry.error ? (
        <div className='rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400 text-sm'>
          {entry.error}
        </div>
      ) : (
        <div className="space-y-3 pl-1">
          {/* Answer text */}
          {entry.answer && (
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              </div>
              <div className="text-sm text-white/90 leading-relaxed">{entry.answer}</div>
            </div>
          )}

          {/* Chart */}
          {entry.table && <div id={`genie-chart-${entry.id}`}><GenieChart table={entry.table} /></div>}

          {/* Table */}
          {entry.table && <GenieTableView table={entry.table} />}

          {/* SQL */}
          {entry.sql && <SqlBlock sql={entry.sql} />}

          {/* Suggested follow-ups */}
          {entry.suggestedQuestions && entry.suggestedQuestions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {entry.suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onAskFollowUp(q)}
                  className='rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/60 text-xs transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white'
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STARTER_QUESTIONS = [
  'Which companies have the most bearish sentiment shift in the last 7 days, and did any miss earnings?',
  'Show NVDA revenue and EPS growth over the last 8 quarters with guidance direction',
  'Compare forward P/E and EV/EBITDA across all 6 sectors — which is cheapest?',
  'What institutional buying or selling happened last quarter for stocks with recent upgrades?',
];

export function GenieAnalytics() {
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<GenieEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [genieAvailable, setGenieAvailable] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/genie/config')
      .then((r) => r.json())
      .then((d) => setGenieAvailable(d.available))
      .catch(() => setGenieAvailable(false));
  }, []);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const askQuestion = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const entryId = `genie-${Date.now()}`;
    const newEntry: GenieEntry = {
      id: entryId,
      question: question.trim(),
      isLoading: true,
    };

    setEntries((prev) => [...prev, newEntry]);
    setInput('');
    setIsLoading(true);
    scrollToBottom();

    try {
      const isFollowUp = !!conversationId;
      const endpoint = isFollowUp ? '/api/genie/follow-up' : '/api/genie/ask';
      const body = isFollowUp
        ? { question: question.trim(), conversationId }
        : { question: question.trim() };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
      }

      const data: GenieResponse = await res.json();

      setConversationId(data.conversationId);
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                isLoading: false,
                answer: data.answer,
                sql: data.sql,
                table: data.table,
                suggestedQuestions: data.suggestedQuestions,
              }
            : e,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get response';
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, isLoading: false, error: message } : e)),
      );
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askQuestion(input);
  };

  if (genieAvailable === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!genieAvailable) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
          <MessageSquareText className="h-8 w-8 text-yellow-500" />
        </div>
        <h2 className="mb-2 font-semibold text-white text-xl">Equity Research Intelligence Not Configured</h2>
        <p className="max-w-md text-center text-white/60">
          Set the DATABRICKS_GENIE_ROOM_ID environment variable to enable AI-powered data analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Hidden data bridge for PDF export */}
      <div
        className="genie-conversation-data hidden"
        data-entries={JSON.stringify(entries.filter((e) => !e.isLoading && !e.error))}
      />
      {/* Scrollable conversation area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl space-y-6">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
                <Sparkles className="h-8 w-8 text-purple-400" />
              </div>
              <h2 className="mb-2 font-semibold text-white text-xl">Equity Research Intelligence</h2>
              <p className="mb-8 max-w-md text-white/60">
                Analyze incoming news sentiment, earnings performance, analyst ratings, valuations, and institutional flows across 35 companies and 6 sectors.
              </p>

              <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => askQuestion(q)}
                    className="group rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    <span className="flex items-start gap-2">
                      <Table className="mt-0.5 h-4 w-4 shrink-0 text-purple-400 opacity-60 group-hover:opacity-100" />
                      {q}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {entries.map((entry) => (
                <GenieEntryCard key={entry.id} entry={entry} onAskFollowUp={askQuestion} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-white/10 border-t bg-[#0a0a14]/60 p-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about stocks, sectors, fundamentals, trends..."
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="gap-2 bg-purple-600 px-6 hover:bg-purple-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Ask
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
