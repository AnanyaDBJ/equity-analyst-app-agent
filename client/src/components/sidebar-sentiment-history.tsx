import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { MoreHorizontalIcon, TrashIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentAnalysis {
  id: string;
  headline: string;
  company: string | null;
  status: 'bullish' | 'bearish' | 'neutral';
  confidence: string;
  confidencePercent: number;
  sentimentScore: number;
  rationale: string | null;
  createdAt: string;
}

type GroupedAnalyses = {
  today: SentimentAnalysis[];
  yesterday: SentimentAnalysis[];
  lastWeek: SentimentAnalysis[];
  lastMonth: SentimentAnalysis[];
  older: SentimentAnalysis[];
};

const groupAnalysesByDate = (analyses: SentimentAnalysis[]): GroupedAnalyses => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return analyses.reduce(
    (groups, analysis) => {
      const analysisDate = new Date(analysis.createdAt);

      if (isToday(analysisDate)) {
        groups.today.push(analysis);
      } else if (isYesterday(analysisDate)) {
        groups.yesterday.push(analysis);
      } else if (analysisDate > oneWeekAgo) {
        groups.lastWeek.push(analysis);
      } else if (analysisDate > oneMonthAgo) {
        groups.lastMonth.push(analysis);
      } else {
        groups.older.push(analysis);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedAnalyses,
  );
};

const StatusIcon = ({ status }: { status: SentimentAnalysis['status'] }) => {
  const icons = {
    bullish: <TrendingUp className="h-4 w-4 text-green-400" />,
    bearish: <TrendingDown className="h-4 w-4 text-red-400" />,
    neutral: <Minus className="h-4 w-4 text-yellow-400" />,
  };
  return icons[status];
};

const SentimentItem = ({
  analysis,
  isActive,
  onDelete,
  onSelect,
}: {
  analysis: SentimentAnalysis;
  isActive: boolean;
  onDelete: (id: string) => void;
  onSelect: (analysis: SentimentAnalysis) => void;
}) => {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => onSelect(analysis)}
        className="flex items-center gap-2"
      >
        <StatusIcon status={analysis.status} />
        <span className='flex-1 truncate'>{analysis.headline}</span>
      </SidebarMenuButton>

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="mr-0.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="bottom" align="end">
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
            onSelect={() => onDelete(analysis.id)}
          >
            <TrashIcon />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export function SidebarSentimentHistory({
  onSelectAnalysis,
  selectedId,
}: {
  onSelectAnalysis?: (analysis: SentimentAnalysis) => void;
  selectedId?: string;
}) {
  const [analyses, setAnalyses] = useState<SentimentAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch sentiment history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/sentiment/history?limit=50');
        if (!response.ok) throw new Error('Failed to fetch history');
        const data = await response.json();
        setAnalyses(data.analyses || []);
      } catch (error) {
        console.error('Error fetching sentiment history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;

    const deletePromise = fetch(`/api/sentiment/${deleteId}`, {
      method: 'DELETE',
    });

    toast.promise(deletePromise, {
      loading: 'Deleting analysis...',
      success: () => {
        setAnalyses((prev) => prev.filter((a) => a.id !== deleteId));
        return 'Analysis deleted successfully';
      },
      error: 'Failed to delete analysis',
    });

    setShowDeleteDialog(false);
    setDeleteId(null);
  };

  if (isLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
          Today
        </div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                key={item}
                className="flex h-8 items-center gap-2 rounded-md px-2"
              >
                <div
                  className="h-4 max-w-(--skeleton-width) flex-1 rounded-md bg-sidebar-accent-foreground/10"
                  style={
                    {
                      '--skeleton-width': `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (analyses.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-sm text-zinc-500">
            Your sentiment analyses will appear here once you start analyzing headlines!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const groupedAnalyses = groupAnalysesByDate(analyses);

  const renderGroup = (title: string, items: SentimentAnalysis[]) => {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
          {title}
        </div>
        {items.map((analysis) => (
          <SentimentItem
            key={analysis.id}
            analysis={analysis}
            isActive={analysis.id === selectedId}
            onDelete={(id) => {
              setDeleteId(id);
              setShowDeleteDialog(true);
            }}
            onSelect={(a) => onSelectAnalysis?.(a)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <div className="flex flex-col gap-6">
              {renderGroup('Today', groupedAnalyses.today)}
              {renderGroup('Yesterday', groupedAnalyses.yesterday)}
              {renderGroup('Last 7 days', groupedAnalyses.lastWeek)}
              {renderGroup('Last 30 days', groupedAnalyses.lastMonth)}
              {renderGroup('Older', groupedAnalyses.older)}
            </div>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              sentiment analysis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
