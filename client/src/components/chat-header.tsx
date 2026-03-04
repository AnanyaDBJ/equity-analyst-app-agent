import { useState } from 'react';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { Button } from '@/components/ui/button';
import { CloudOffIcon, Settings, FlaskConical, FileDown, FileText, ChevronDown } from 'lucide-react';
import { useConfig } from '@/hooks/use-config';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SettingsModal } from './settings-modal';
import { PdfReportModal } from './pdf-report-modal';
import type { GenieEntryData, ChatMessageData, SentimentData, SentimentMetricsData } from './pdf-report-modal';

// Databricks Logo Component - Official layered diamond design
const DatabricksLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Background hexagon shape */}
    <path d="M20 2L4 11V29L20 38L36 29V11L20 2Z" fill="#FF3621"/>
    {/* Middle layer */}
    <path d="M20 8L8 14V26L20 32L32 26V14L20 8Z" fill="white" fillOpacity="0.3"/>
    {/* Inner core */}
    <path d="M20 14L14 17.5V22.5L20 26L26 22.5V17.5L20 14Z" fill="white"/>
  </svg>
);

// Collect data from the DOM for PDF export
function collectPdfData(): {
  genieEntries: GenieEntryData[];
  chatMessages: ChatMessageData[];
  sentimentAnalyses: SentimentData[];
  sentimentMetrics: SentimentMetricsData | undefined;
} {
  // Collect Genie entries from DOM
  const genieEntries: GenieEntryData[] = [];
  const genieContainer = document.querySelector('.genie-conversation-data');
  if (genieContainer) {
    try {
      const raw = genieContainer.getAttribute('data-entries');
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const e of parsed) {
          if (!e.isLoading && !e.error) {
            genieEntries.push({
              question: e.question,
              answer: e.answer,
              sql: e.sql,
              table: e.table,
            });
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Collect chat messages from DOM
  const chatMessages: ChatMessageData[] = [];
  const chatContainer = document.querySelector('.chat-messages-data');
  if (chatContainer) {
    try {
      const raw = chatContainer.getAttribute('data-messages');
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const m of parsed) {
          chatMessages.push({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          });
        }
      }
    } catch { /* ignore */ }
  }

  // Collect sentiment data from DOM
  const sentimentAnalyses: SentimentData[] = [];
  let sentimentMetrics: SentimentMetricsData | undefined;
  const sentimentContainer = document.querySelector('.sentiment-data');
  if (sentimentContainer) {
    try {
      const rawAnalyses = sentimentContainer.getAttribute('data-analyses');
      if (rawAnalyses) {
        sentimentAnalyses.push(...JSON.parse(rawAnalyses));
      }
      const rawMetrics = sentimentContainer.getAttribute('data-metrics');
      if (rawMetrics) {
        sentimentMetrics = JSON.parse(rawMetrics);
      }
    } catch { /* ignore */ }
  }

  return { genieEntries, chatMessages, sentimentAnalyses, sentimentMetrics };
}

export function ChatHeader() {
  const { chatHistoryEnabled } = useConfig();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfData, setPdfData] = useState<ReturnType<typeof collectPdfData>>({
    genieEntries: [],
    chatMessages: [],
    sentimentAnalyses: [],
    sentimentMetrics: undefined,
  });

  const handleOpenPdf = () => {
    setPdfData(collectPdfData());
    setPdfOpen(true);
  };

  return (
    <>
      <header className='sticky top-0 z-10 flex flex-col border-white/10 border-b bg-[#0a0a14]/80 backdrop-blur-xl backdrop-saturate-150'>
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <SidebarToggle />

            {/* Databricks Logo and Title */}
            <div className="flex items-center gap-2.5">
              <DatabricksLogo className="h-7 w-7" />
              <div className="hidden md:flex md:flex-col">
                <span className='font-semibold text-sm text-white leading-tight'>Equity Analyst</span>
                <span className="text-white/60 text-xs">Powered by Databricks</span>
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!chatHistoryEnabled && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-white/60 text-xs">
                      <CloudOffIcon className="h-3 w-3" />
                      <span className="hidden sm:inline">Ephemeral</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Chat history disabled - conversations are not saved</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Actions Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className='gap-1.5 text-white/70 hover:bg-white/10 hover:text-white'
                >
                  Actions
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 border-white/10 bg-[#1a1a2e]">
                <DropdownMenuItem
                  onClick={() => window.open('/report', '_blank')}
                  className="gap-2 text-emerald-400 focus:bg-emerald-400/10 focus:text-emerald-300"
                >
                  <FileText className="h-4 w-4" />
                  Analyst Report
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleOpenPdf}
                  className="gap-2 text-blue-400 focus:bg-blue-400/10 focus:text-blue-300"
                >
                  <FileDown className="h-4 w-4" />
                  Export PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onClick={() => {
                    const experimentUrl = 'https://e2-demo-field-eng.cloud.databricks.com/ml/experiments/9a990417d8fd4bb1a381d7798efb35e8/traces?o=1444828305810485&sqlWarehouseId=4b9b953939869799';
                    window.open(experimentUrl, '_blank');
                  }}
                  className="gap-2 text-purple-400 focus:bg-purple-400/10 focus:text-purple-300"
                >
                  <FlaskConical className="h-4 w-4" />
                  MLflow Traces
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings Button - kept separate as frequent action */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className='h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white'
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <PdfReportModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        genieEntries={pdfData.genieEntries}
        chatMessages={pdfData.chatMessages}
        sentimentAnalyses={pdfData.sentimentAnalyses}
        sentimentMetrics={pdfData.sentimentMetrics}
      />
    </>
  );
}
