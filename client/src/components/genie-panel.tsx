import { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GenieAnalytics } from './genie-analytics';
import { useActiveTab, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH } from '@/contexts/ActiveTabContext';

export function GeniePanel() {
  const { geniePanelOpen, setGeniePanelOpen, geniePanelWidth, setGeniePanelWidth } = useActiveTab();
  const [resetKey, setResetKey] = useState(0);
  const [isResizing, setIsResizing] = useState(false);

  // Resize handling
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setGeniePanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setGeniePanelWidth]);

  const handleNewChat = () => {
    setResetKey((k) => k + 1);
  };

  return (
    <>
      {/* Floating Genie Button (bottom-right) */}
      {!geniePanelOpen && (
        <button
          type="button"
          onClick={() => setGeniePanelOpen(true)}
          className='fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-600/30 transition-all hover:scale-105 hover:bg-purple-500 hover:shadow-purple-600/40 hover:shadow-xl active:scale-95'
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Slide-in Genie Panel (from right) */}
      <div
        className={`fixed inset-y-0 right-0 z-40 flex max-w-[90vw] flex-col border-white/10 border-l bg-[#0a0a14]/95 backdrop-blur-xl transition-transform duration-300 ease-in-out ${
          geniePanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: geniePanelWidth }}
      >
        {/* Resize Handle (left edge) */}
        <div
          className="group absolute top-0 left-0 z-50 flex h-full w-2 cursor-col-resize items-center justify-center hover:bg-white/10"
          onMouseDown={handleResizeStart}
        >
          <div className={`h-8 w-1 rounded-full transition-colors ${isResizing ? 'bg-purple-500' : 'bg-white/20 group-hover:bg-white/40'}`} />
        </div>
        {/* Panel Header */}
        <div className="shrink-0 border-white/10 border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              <span className="font-semibold text-sm text-white">Equity Research Intelligence</span>
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-300">Stocks & Sectors</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={handleNewChat}
                title="New Conversation"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => setGeniePanelOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Genie Content - key forces remount on reset */}
        <div className="flex min-h-0 flex-1 flex-col">
          <GenieAnalytics key={resetKey} />
        </div>
      </div>

      {/* Backdrop overlay when panel is open (mobile only) */}
      {geniePanelOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setGeniePanelOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setGeniePanelOpen(false);
          }}
        />
      )}
    </>
  );
}
