import { useState } from 'react';
import { X, FileDown, Loader2, CheckCircle, MessageSquare, Sparkles, BarChart3, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type jsPDFType from 'jspdf';

interface PdfReportModalProps {
  open: boolean;
  onClose: () => void;
  // Data sources
  genieEntries?: GenieEntryData[];
  chatMessages?: ChatMessageData[];
  sentimentAnalyses?: SentimentData[];
  sentimentMetrics?: SentimentMetricsData;
}

export interface GenieEntryData {
  id?: string;
  question: string;
  answer?: string;
  sql?: string;
  table?: {
    columns: { name: string; type: string }[];
    rows: string[][];
    rowCount: number;
  };
}

export interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface SentimentData {
  headline: string;
  company: string;
  status: 'bullish' | 'bearish' | 'neutral';
  confidence: string;
  confidencePercent: number;
  sentimentScore: number;
  rationale: string;
  timestamp: string;
}

export interface SentimentMetricsData {
  total: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  bullishPercent: number;
  bearishPercent: number;
  avgConfidence: number;
  avgSentiment: number;
}

type ReportSection = 'genie' | 'chat' | 'sentiment';

const SECTION_CONFIG: Record<ReportSection, { label: string; description: string; icon: React.ElementType; color: string }> = {
  genie: {
    label: 'Equity Research Intelligence',
    description: 'Genie Q&A conversation with tables and SQL queries',
    icon: Sparkles,
    color: 'text-purple-400',
  },
  chat: {
    label: 'Equity Analyst Chat',
    description: 'Market analysis chat conversation history',
    icon: MessageSquare,
    color: 'text-[#FF3621]',
  },
  sentiment: {
    label: 'Sentiment Dashboard',
    description: 'News sentiment analyses, metrics, and summary',
    icon: BarChart3,
    color: 'text-blue-400',
  },
};

// PDF Colors
const DARK_BG = [15, 15, 25] as const;
const HEADER_BG = [30, 30, 50] as const;
const ACCENT_PURPLE = [139, 92, 246] as const;
const ACCENT_RED = [255, 54, 33] as const;
const ACCENT_BLUE = [59, 130, 246] as const;
const TEXT_WHITE = [240, 240, 240] as const;
const TEXT_MUTED = [160, 160, 180] as const;
const GREEN = [34, 197, 94] as const;
const RED = [239, 68, 68] as const;
const YELLOW = [234, 179, 8] as const;

function addPageHeader(doc: jsPDFType, title: string, pageNum: number) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, pageWidth, 18, 'F');

  // Logo text
  doc.setTextColor(...ACCENT_PURPLE);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Equity Analyst', 10, 12);

  // Title
  doc.setTextColor(...TEXT_WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(title, pageWidth / 2, 12, { align: 'center' });

  // Page number
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Page ${pageNum}`, pageWidth - 10, 12, { align: 'right' });
}

function addSectionTitle(doc: jsPDFType, y: number, title: string, color: readonly [number, number, number]): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Section line
  doc.setDrawColor(...color);
  doc.setLineWidth(1);
  doc.line(10, y, pageWidth - 10, y);

  y += 8;
  doc.setTextColor(...color);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 10, y);

  return y + 10;
}

function checkPageBreak(doc: jsPDFType, y: number, needed: number, title: string, pageNum: { current: number }): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    pageNum.current++;
    addPageHeader(doc, title, pageNum.current);
    return 25;
  }
  return y;
}

async function captureChartImage(elementId: string): Promise<string | null> {
  const el = document.getElementById(elementId);
  if (!el) return null;
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, {
      backgroundColor: '#0f0f19',
      scale: 2,
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function addImageToPdf(
  doc: jsPDFType,
  imgData: string,
  y: number,
  maxWidth: number,
  maxHeight: number,
  reportTitle: string,
  pageNum: { current: number },
): number {
  const img = new Image();
  img.src = imgData;

  // Calculate dimensions to fit within maxWidth/maxHeight while keeping aspect ratio
  const imgProps = doc.getImageProperties(imgData);
  let width = maxWidth;
  let height = (imgProps.height / imgProps.width) * width;
  if (height > maxHeight) {
    height = maxHeight;
    width = (imgProps.width / imgProps.height) * height;
  }

  y = checkPageBreak(doc, y, height + 5, reportTitle, pageNum);
  doc.addImage(imgData, 'PNG', 10, y, width, height);
  return y + height + 5;
}

async function generatePdf(
  sections: ReportSection[],
  genieEntries: GenieEntryData[],
  chatMessages: ChatMessageData[],
  sentimentAnalyses: SentimentData[],
  sentimentMetrics: SentimentMetricsData | undefined,
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const reportTitle = 'Equity Analyst Report';
  const pageNum = { current: 1 };
  const timestamp = new Date().toLocaleString();

  // === COVER PAGE ===
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');

  // Accent bar
  doc.setFillColor(...ACCENT_PURPLE);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Title
  doc.setTextColor(...TEXT_WHITE);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Equity Analyst', pageWidth / 2, 60, { align: 'center' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Stock Research & Market Intelligence Report', pageWidth / 2, 72, { align: 'center' });

  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${timestamp}`, pageWidth / 2, 90, { align: 'center' });

  // Sections included
  let coverY = 115;
  doc.setTextColor(...TEXT_WHITE);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Sections:', pageWidth / 2, coverY, { align: 'center' });
  coverY += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const section of sections) {
    const cfg = SECTION_CONFIG[section];
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`- ${cfg.label}`, pageWidth / 2, coverY, { align: 'center' });
    coverY += 7;
  }

  // Footer
  doc.setTextColor(...TEXT_MUTED);
  doc.setFontSize(8);
  doc.text('Confidential - For Internal Use Only', pageWidth / 2, doc.internal.pageSize.getHeight() - 15, { align: 'center' });

  // === CONTENT PAGES ===

  // --- GENIE SECTION ---
  if (sections.includes('genie') && genieEntries.length > 0) {
    doc.addPage();
    pageNum.current++;
    doc.setFillColor(...DARK_BG);
    doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
    addPageHeader(doc, reportTitle, pageNum.current);

    let y = addSectionTitle(doc, 22, 'Equity Research Intelligence', ACCENT_PURPLE);

    for (const entry of genieEntries) {
      y = checkPageBreak(doc, y, 30, reportTitle, pageNum);

      // Question
      doc.setTextColor(...ACCENT_RED);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Q:', 10, y);
      doc.setTextColor(...TEXT_WHITE);
      doc.setFont('helvetica', 'normal');
      const qLines = doc.splitTextToSize(entry.question, pageWidth - 25);
      doc.text(qLines, 18, y);
      y += qLines.length * 5 + 3;

      // Answer
      if (entry.answer) {
        y = checkPageBreak(doc, y, 20, reportTitle, pageNum);
        doc.setTextColor(...ACCENT_PURPLE);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('A:', 10, y);
        doc.setTextColor(...TEXT_WHITE);
        doc.setFont('helvetica', 'normal');
        const aLines = doc.splitTextToSize(entry.answer, pageWidth - 25);
        doc.text(aLines, 18, y);
        y += aLines.length * 5 + 3;
      }

      // Chart image (captured from DOM)
      if (entry.id) {
        const chartImg = await captureChartImage(`genie-chart-${entry.id}`);
        if (chartImg) {
          y = addImageToPdf(doc, chartImg, y, pageWidth - 20, 60, reportTitle, pageNum);
        }
      }

      // Table
      if (entry.table && entry.table.rows.length > 0) {
        y = checkPageBreak(doc, y, 30, reportTitle, pageNum);

        autoTable(doc, {
          startY: y,
          head: [entry.table.columns.map((c) => c.name)],
          body: entry.table.rows.map((row) =>
            row.map((cell) => (cell === null ? '' : String(cell))),
          ),
          theme: 'grid',
          styles: {
            fillColor: DARK_BG as unknown as number[],
            textColor: TEXT_WHITE as unknown as number[],
            fontSize: 7,
            cellPadding: 2,
            lineColor: [60, 60, 80],
            lineWidth: 0.2,
          },
          headStyles: {
            fillColor: HEADER_BG as unknown as number[],
            textColor: ACCENT_PURPLE as unknown as number[],
            fontStyle: 'bold',
            fontSize: 7,
          },
          alternateRowStyles: {
            fillColor: [20, 20, 35] as number[],
          },
          margin: { left: 10, right: 10 },
        });

        y = (doc as any).lastAutoTable?.finalY + 5 || y + 30;
      }

      // SQL
      if (entry.sql) {
        y = checkPageBreak(doc, y, 15, reportTitle, pageNum);
        doc.setTextColor(...TEXT_MUTED);
        doc.setFontSize(7);
        doc.setFont('courier', 'normal');
        const sqlLines = doc.splitTextToSize(`SQL: ${entry.sql}`, pageWidth - 20);
        doc.text(sqlLines, 10, y);
        y += sqlLines.length * 4 + 5;
        doc.setFont('helvetica', 'normal');
      }

      y += 5;
    }
  }

  // --- CHAT SECTION ---
  if (sections.includes('chat') && chatMessages.length > 0) {
    doc.addPage();
    pageNum.current++;
    doc.setFillColor(...DARK_BG);
    doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
    addPageHeader(doc, reportTitle, pageNum.current);

    let y = addSectionTitle(doc, 22, 'Equity Analyst Chat', ACCENT_RED);

    for (const msg of chatMessages) {
      y = checkPageBreak(doc, y, 15, reportTitle, pageNum);

      const isUser = msg.role === 'user';
      doc.setTextColor(...(isUser ? ACCENT_RED : ACCENT_BLUE));
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(isUser ? 'You:' : 'Assistant:', 10, y);

      doc.setTextColor(...TEXT_WHITE);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(msg.content, pageWidth - 25);
      doc.text(lines, 10, y + 5);
      y += 5 + lines.length * 5 + 4;
    }
  }

  // --- SENTIMENT SECTION ---
  if (sections.includes('sentiment')) {
    doc.addPage();
    pageNum.current++;
    doc.setFillColor(...DARK_BG);
    doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
    addPageHeader(doc, reportTitle, pageNum.current);

    let y = addSectionTitle(doc, 22, 'Sentiment Analysis Summary', ACCENT_BLUE);

    // Metrics summary
    if (sentimentMetrics) {
      const m = sentimentMetrics;

      // Metrics grid
      const metrics = [
        ['Total Analyses', String(m.total)],
        ['Bullish', `${m.bullishCount} (${m.bullishPercent}%)`],
        ['Bearish', `${m.bearishCount} (${m.bearishPercent}%)`],
        ['Neutral', String(m.neutralCount)],
        ['Avg Confidence', `${m.avgConfidence}%`],
        ['Avg Sentiment', m.avgSentiment.toFixed(2)],
      ];

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: metrics,
        theme: 'grid',
        styles: {
          fillColor: DARK_BG as unknown as number[],
          textColor: TEXT_WHITE as unknown as number[],
          fontSize: 9,
          cellPadding: 3,
          lineColor: [60, 60, 80],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: HEADER_BG as unknown as number[],
          textColor: ACCENT_BLUE as unknown as number[],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: TEXT_MUTED as unknown as number[] },
        },
        margin: { left: 10, right: 10 },
        tableWidth: 100,
      });

      y = (doc as any).lastAutoTable?.finalY + 10 || y + 50;
    }

    // Capture and embed sentiment dashboard charts
    const sentimentCharts = [
      { id: 'chart-sentiment-trend', label: 'Sentiment Trend (14 Days)' },
      { id: 'chart-sentiment-distribution', label: 'Sentiment Distribution' },
      { id: 'chart-portfolio-health', label: 'Portfolio Health' },
      { id: 'chart-company-breakdown', label: 'Company Sentiment Breakdown' },
    ];

    for (const chart of sentimentCharts) {
      const img = await captureChartImage(chart.id);
      if (img) {
        y = checkPageBreak(doc, y, 70, reportTitle, pageNum);
        doc.setTextColor(...TEXT_WHITE);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(chart.label, 10, y);
        y += 5;
        y = addImageToPdf(doc, img, y, pageWidth - 20, 60, reportTitle, pageNum);
        y += 3;
      }
    }

    // Individual analyses
    if (sentimentAnalyses.length > 0) {
      y = checkPageBreak(doc, y, 20, reportTitle, pageNum);

      doc.setTextColor(...TEXT_WHITE);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Analysis Details', 10, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [['Headline', 'Company', 'Status', 'Score', 'Confidence']],
        body: sentimentAnalyses.map((a) => [
          a.headline.length > 60 ? `${a.headline.slice(0, 57)}...` : a.headline,
          a.company || '-',
          a.status.toUpperCase(),
          a.sentimentScore.toFixed(2),
          `${a.confidence} (${a.confidencePercent}%)`,
        ]),
        theme: 'grid',
        styles: {
          fillColor: DARK_BG as unknown as number[],
          textColor: TEXT_WHITE as unknown as number[],
          fontSize: 7,
          cellPadding: 2,
          lineColor: [60, 60, 80],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: HEADER_BG as unknown as number[],
          textColor: ACCENT_BLUE as unknown as number[],
          fontStyle: 'bold',
          fontSize: 7,
        },
        alternateRowStyles: {
          fillColor: [20, 20, 35] as number[],
        },
        columnStyles: {
          2: {
            fontStyle: 'bold',
          },
        },
        didParseCell: (data) => {
          // Color the Status column
          if (data.section === 'body' && data.column.index === 2) {
            const val = String(data.cell.raw).toLowerCase();
            if (val === 'bullish') data.cell.styles.textColor = GREEN as unknown as number[];
            else if (val === 'bearish') data.cell.styles.textColor = RED as unknown as number[];
            else data.cell.styles.textColor = YELLOW as unknown as number[];
          }
        },
        margin: { left: 10, right: 10 },
      });
    }
  }

  // Save
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`EquityAnalyst_Report_${dateStr}.pdf`);
}

export function PdfReportModal({
  open,
  onClose,
  genieEntries = [],
  chatMessages = [],
  sentimentAnalyses = [],
  sentimentMetrics,
}: PdfReportModalProps) {
  const [selectedSections, setSelectedSections] = useState<Set<ReportSection>>(new Set(['genie', 'chat', 'sentiment']));
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  if (!open) return null;

  const toggleSection = (section: ReportSection) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSections(new Set(['genie', 'chat', 'sentiment']));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerated(false);

    // Small delay for UX
    await new Promise((r) => setTimeout(r, 500));

    try {
      await generatePdf(
        Array.from(selectedSections),
        genieEntries,
        chatMessages,
        sentimentAnalyses,
        sentimentMetrics,
      );
      setGenerated(true);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const sectionCounts: Record<ReportSection, number> = {
    genie: genieEntries.length,
    chat: chatMessages.length,
    sentiment: sentimentAnalyses.length,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-white/10 border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Export PDF Report</h2>
                <p className="text-white/50 text-xs">Choose what to include</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:bg-white/10"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Section Selection */}
          <div className="space-y-2 px-6 py-5">
            {(Object.entries(SECTION_CONFIG) as [ReportSection, typeof SECTION_CONFIG[ReportSection]][]).map(
              ([key, cfg]) => {
                const Icon = cfg.icon;
                const isSelected = selectedSections.has(key);
                const count = sectionCounts[key];

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSection(key)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-white/20 bg-white/10'
                        : 'border-white/5 bg-white/[0.02] opacity-60 hover:opacity-80'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        isSelected ? 'border-blue-400 bg-blue-500' : 'border-white/30 bg-white/5'
                      }`}
                    >
                      {isSelected && (
                        <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    <Icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-white">{cfg.label}</span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                          {count} {count === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      <p className="text-white/40 text-xs">{cfg.description}</p>
                    </div>
                  </button>
                );
              },
            )}

            {/* Select All */}
            <button
              type="button"
              onClick={selectAll}
              className="w-full text-center text-blue-400 text-xs hover:text-blue-300"
            >
              Select All
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-white/10 border-t px-6 py-4">
            <p className="text-white/40 text-xs">
              {selectedSections.size} section{selectedSections.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-white/70"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={selectedSections.size === 0 || isGenerating}
                onClick={handleGenerate}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : generated ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Downloaded!
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    Generate PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
