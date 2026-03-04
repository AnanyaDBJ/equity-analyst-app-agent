import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Trash2,
  MessageSquare,
  BarChart3,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useSession } from '@/contexts/SessionContext';
import { toast } from './toast';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FontSize = 'small' | 'medium' | 'large';

const FONT_SIZE_KEY = 'settings:fontSize';
const DASHBOARD_DEFAULT_VIEW_KEY = 'settings:dashboardDefaultView';

function getFontSize(): FontSize {
  return (localStorage.getItem(FONT_SIZE_KEY) as FontSize) || 'medium';
}

function getDashboardDefaultView(): 'sentiment' | 'stock' {
  return (localStorage.getItem(DASHBOARD_DEFAULT_VIEW_KEY) as 'sentiment' | 'stock') || 'sentiment';
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { chatHistoryEnabled } = useAppConfig();
  const { session } = useSession();
  const navigate = useNavigate();

  const [fontSize, setFontSizeState] = useState<FontSize>(getFontSize);
  const [dashboardDefaultView, setDashboardDefaultViewState] = useState<'sentiment' | 'stock'>(getDashboardDefaultView);

  // Deletion states
  const [isDeletingChats, setIsDeletingChats] = useState(false);
  const [isDeletingSentiment, setIsDeletingSentiment] = useState(false);
  const [confirmDeleteChats, setConfirmDeleteChats] = useState(false);
  const [confirmDeleteSentiment, setConfirmDeleteSentiment] = useState(false);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem(FONT_SIZE_KEY, size);
    document.documentElement.dataset.fontSize = size;
  };

  const setDashboardDefaultView = (view: 'sentiment' | 'stock') => {
    setDashboardDefaultViewState(view);
    localStorage.setItem(DASHBOARD_DEFAULT_VIEW_KEY, view);
  };

  const handleDeleteAllChats = async () => {
    if (!confirmDeleteChats) {
      setConfirmDeleteChats(true);
      return;
    }
    setIsDeletingChats(true);
    try {
      const res = await fetch('/api/history', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete chat history');
      toast({ type: 'success', description: 'All chat history deleted' });
      setConfirmDeleteChats(false);
      navigate('/');
    } catch {
      toast({ type: 'error', description: 'Failed to delete chat history' });
    } finally {
      setIsDeletingChats(false);
    }
  };

  const handleDeleteAllSentiment = async () => {
    if (!confirmDeleteSentiment) {
      setConfirmDeleteSentiment(true);
      return;
    }
    setIsDeletingSentiment(true);
    try {
      const res = await fetch('/api/sentiment/history', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete sentiment history');
      toast({ type: 'success', description: 'All sentiment analyses deleted' });
      setConfirmDeleteSentiment(false);
      window.location.reload();
    } catch {
      toast({ type: 'error', description: 'Failed to delete sentiment history' });
    } finally {
      setIsDeletingSentiment(false);
    }
  };

  const handleResetPreferences = () => {
    localStorage.removeItem(FONT_SIZE_KEY);
    localStorage.removeItem(DASHBOARD_DEFAULT_VIEW_KEY);
    localStorage.removeItem('chat-model');
    setFontSizeState('medium');
    setDashboardDefaultViewState('sentiment');
    document.documentElement.dataset.fontSize = 'medium';
    toast({ type: 'success', description: 'Preferences reset to defaults' });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setConfirmDeleteChats(false);
        setConfirmDeleteSentiment(false);
      }
      onOpenChange(isOpen);
    }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className='data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in' />
        <DialogPrimitive.Content className='data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl border border-white/10 bg-[#0a0a0f] p-0 shadow-2xl data-[state=closed]:animate-out data-[state=open]:animate-in'>
          {/* Header */}
          <div className="flex items-center justify-between border-white/10 border-b px-6 py-4">
            <DialogPrimitive.Title className="font-semibold text-lg text-white">
              Settings
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          {/* Scrollable content */}
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">

            {/* User Info */}
            {session?.user && (
              <section className="mb-6">
                <h3 className="mb-3 font-medium text-sm text-white/50 uppercase tracking-wider">Account</h3>
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-sm text-white">{session.user.preferredUsername || session.user.name || session.user.email}</div>
                  {session.user.email && (
                    <div className='mt-0.5 text-white/50 text-xs'>{session.user.email}</div>
                  )}
                </div>
              </section>
            )}

            {/* Appearance */}
            <section className="mb-6">
              <h3 className="mb-3 font-medium text-sm text-white/50 uppercase tracking-wider">Appearance</h3>

              {/* Font Size */}
              <div>
                <label className="mb-2 block text-sm text-white/80">Font Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'small', label: 'Small' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'large', label: 'Large' },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFontSize(value)}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-sm transition-all',
                        fontSize === value
                          ? 'border-[#FF3621]/50 bg-[#FF3621]/10 text-white'
                          : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Dashboard Preferences */}
            <section className="mb-6">
              <h3 className="mb-3 font-medium text-sm text-white/50 uppercase tracking-wider">Dashboard</h3>

              <div>
                <label className="mb-2 block text-sm text-white/80">Default View</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDashboardDefaultView('sentiment')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all',
                      dashboardDefaultView === 'sentiment'
                        ? 'border-[#FF3621]/50 bg-[#FF3621]/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white',
                    )}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Sentiment Analysis
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardDefaultView('stock')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all',
                      dashboardDefaultView === 'stock'
                        ? 'border-[#FF3621]/50 bg-[#FF3621]/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white',
                    )}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Stock History
                  </button>
                </div>
              </div>
            </section>

            {/* Data Management */}
            <section className="mb-6">
              <h3 className="mb-3 font-medium text-sm text-white/50 uppercase tracking-wider">Data Management</h3>
              <div className="space-y-3">

                {/* Delete Chat History */}
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-white/50" />
                    <div>
                      <div className="text-sm text-white">Chat History</div>
                      <div className='text-white/40 text-xs'>
                        {chatHistoryEnabled ? 'Delete all saved conversations' : 'Chat history is disabled'}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!chatHistoryEnabled || isDeletingChats}
                    onClick={handleDeleteAllChats}
                    className={cn(
                      'gap-1.5 text-sm',
                      confirmDeleteChats
                        ? 'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300'
                        : 'text-red-400 hover:bg-red-400/10 hover:text-red-300',
                    )}
                  >
                    {isDeletingChats ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : confirmDeleteChats ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {confirmDeleteChats ? 'Confirm Delete' : 'Delete All'}
                  </Button>
                </div>

                {/* Delete Sentiment History */}
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-4 w-4 text-white/50" />
                    <div>
                      <div className="text-sm text-white">Sentiment Analyses</div>
                      <div className='text-white/40 text-xs'>Delete all saved sentiment analyses</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isDeletingSentiment}
                    onClick={handleDeleteAllSentiment}
                    className={cn(
                      'gap-1.5 text-sm',
                      confirmDeleteSentiment
                        ? 'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300'
                        : 'text-red-400 hover:bg-red-400/10 hover:text-red-300',
                    )}
                  >
                    {isDeletingSentiment ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : confirmDeleteSentiment ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {confirmDeleteSentiment ? 'Confirm Delete' : 'Delete All'}
                  </Button>
                </div>
              </div>
            </section>

            {/* Reset */}
            <section className="mb-2">
              <h3 className="mb-3 font-medium text-sm text-white/50 uppercase tracking-wider">Reset</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetPreferences}
                className="w-full border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                Reset All Preferences to Defaults
              </Button>
            </section>
          </div>

          {/* Footer */}
          <div className="border-white/10 border-t px-6 py-3">
            <div className='text-center text-white/30 text-xs'>
              Equity Analyst &middot; Powered by Databricks
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
