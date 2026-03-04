import { ChatHeader } from '@/components/chat-header';
import { NewsFeed } from './news-feed';
import { ChatPanel } from './chat-panel';
import { GeniePanel } from './genie-panel';
import { useActiveTab } from '@/contexts/ActiveTabContext';
import type {
  ChatMessage,
  VisibilityType,
} from '@chat-template/core';
import type { ClientSession } from '@chat-template/auth';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: ClientSession;
}) {
  const { chatPanelOpen, geniePanelOpen, chatPanelWidth, geniePanelWidth } = useActiveTab();

  return (
    <>
      {/* Outer flex container - spacers push main content to fit between panels */}
      <div className="flex h-dvh w-screen overflow-hidden">
        {/* Left spacer - matches chat panel width */}
        <div
          className="shrink-0 transition-[width] duration-300 ease-in-out"
          style={{ width: chatPanelOpen ? chatPanelWidth : 0 }}
        />

        {/* Main content - shrinks to fill remaining space */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ChatHeader />
          <NewsFeed />
        </div>

        {/* Right spacer - matches genie panel width */}
        <div
          className="shrink-0 transition-[width] duration-300 ease-in-out"
          style={{ width: geniePanelOpen ? geniePanelWidth : 0 }}
        />
      </div>

      {/* Slide-in Chat Panel (Left) */}
      <ChatPanel
        id={id}
        initialMessages={initialMessages}
        initialChatModel={initialChatModel}
        initialVisibilityType={initialVisibilityType}
        isReadonly={isReadonly}
        session={session}
      />

      {/* Slide-in Genie Panel (Right) */}
      <GeniePanel />
    </>
  );
}
