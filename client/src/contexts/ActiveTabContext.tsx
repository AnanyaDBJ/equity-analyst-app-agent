import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type ActiveTab = 'chat' | 'news';

const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 600;

interface ActiveTabContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  chatPanelOpen: boolean;
  setChatPanelOpen: (open: boolean) => void;
  toggleChatPanel: () => void;
  geniePanelOpen: boolean;
  setGeniePanelOpen: (open: boolean) => void;
  toggleGeniePanel: () => void;
  chatPanelWidth: number;
  setChatPanelWidth: (width: number) => void;
  geniePanelWidth: number;
  setGeniePanelWidth: (width: number) => void;
}

export { MIN_PANEL_WIDTH, MAX_PANEL_WIDTH, DEFAULT_PANEL_WIDTH };

const ActiveTabContext = createContext<ActiveTabContextType | undefined>(undefined);

export function ActiveTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('news');
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [geniePanelOpen, setGeniePanelOpen] = useState(false);

  // Panel widths with localStorage persistence
  const [chatPanelWidth, setChatPanelWidthState] = useState(() => {
    const stored = localStorage.getItem('chatPanelWidth');
    return stored ? Number(stored) : DEFAULT_PANEL_WIDTH;
  });
  const [geniePanelWidth, setGeniePanelWidthState] = useState(() => {
    const stored = localStorage.getItem('geniePanelWidth');
    return stored ? Number(stored) : DEFAULT_PANEL_WIDTH;
  });

  // Persist widths to localStorage
  useEffect(() => {
    localStorage.setItem('chatPanelWidth', String(chatPanelWidth));
  }, [chatPanelWidth]);

  useEffect(() => {
    localStorage.setItem('geniePanelWidth', String(geniePanelWidth));
  }, [geniePanelWidth]);

  const setChatPanelWidth = (width: number) => {
    const clamped = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, width));
    // Snap to default when close (within 20px)
    const snapped = Math.abs(clamped - DEFAULT_PANEL_WIDTH) < 20 ? DEFAULT_PANEL_WIDTH : clamped;
    setChatPanelWidthState(snapped);
  };

  const setGeniePanelWidth = (width: number) => {
    const clamped = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, width));
    // Snap to default when close (within 20px)
    const snapped = Math.abs(clamped - DEFAULT_PANEL_WIDTH) < 20 ? DEFAULT_PANEL_WIDTH : clamped;
    setGeniePanelWidthState(snapped);
  };

  const toggleChatPanel = () => setChatPanelOpen((prev) => !prev);
  const toggleGeniePanel = () => setGeniePanelOpen((prev) => !prev);

  return (
    <ActiveTabContext.Provider value={{
      activeTab, setActiveTab,
      chatPanelOpen, setChatPanelOpen, toggleChatPanel,
      geniePanelOpen, setGeniePanelOpen, toggleGeniePanel,
      chatPanelWidth, setChatPanelWidth,
      geniePanelWidth, setGeniePanelWidth
    }}>
      {children}
    </ActiveTabContext.Provider>
  );
}

export function useActiveTab() {
  const context = useContext(ActiveTabContext);
  if (context === undefined) {
    throw new Error('useActiveTab must be used within an ActiveTabProvider');
  }
  return context;
}
