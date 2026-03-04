import { useState, useEffect, useCallback, useRef } from 'react';
import type { UIMessageChunk } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useSWRConfig } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import useSWRInfinite from 'swr/infinite';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { X, MessageSquare, History, PlusIcon, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { getChatHistoryPaginationKey, type ChatHistory } from './sidebar-history';
import { toast } from './toast';
import { fetchWithErrorHandlers, generateUUID, fetcher } from '@/lib/utils';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { ChatSDKError } from '@chat-template/core/errors';
import { ChatTransport } from '../lib/ChatTransport';
import { softNavigateToChatId } from '@/lib/navigation';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useActiveTab, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH } from '@/contexts/ActiveTabContext';
import type {
  Attachment,
  ChatMessage,
  VisibilityType,
} from '@chat-template/core';
import type { ClientSession } from '@chat-template/auth';

interface ChatPanelProps {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: ClientSession;
}

export function ChatPanel({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
}: ChatPanelProps) {
  const { chatPanelOpen, setChatPanelOpen, chatPanelWidth, setChatPanelWidth } = useActiveTab();
  const [isResizing, setIsResizing] = useState(false);
  const navigate = useNavigate();
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { chatHistoryEnabled } = useAppConfig();

  const [input, setInput] = useState<string>('');
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch chat history for the history drawer
  const {
    data: paginatedChatHistories,
  } = useSWRInfinite<ChatHistory>(getChatHistoryPaginationKey, fetcher, {
    fallbackData: [],
  });

  const allChats = paginatedChatHistories?.flatMap((page) => page.chats) ?? [];

  const [streamCursor, setStreamCursor] = useState(0);
  const streamCursorRef = useRef(streamCursor);
  streamCursorRef.current = streamCursor;
  const [lastPart, setLastPart] = useState<UIMessageChunk | undefined>();
  const lastPartRef = useRef<UIMessageChunk | undefined>(lastPart);
  lastPartRef.current = lastPart;

  const resumeAttemptCountRef = useRef(0);
  const maxResumeAttempts = 3;

  const abortController = useRef<AbortController | null>(new AbortController());
  useEffect(() => {
    return () => {
      abortController.current?.abort('ABORT_SIGNAL');
    };
  }, []);

  const fetchWithAbort = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const signal = abortController.current?.signal;
      return fetchWithErrorHandlers(input, { ...init, signal });
    },
    [],
  );

  const stop = useCallback(() => {
    abortController.current?.abort('USER_ABORT_SIGNAL');
  }, []);

  const isNewChat = initialMessages.length === 0;
  const didFetchHistoryOnNewChat = useRef(false);
  const fetchChatHistory = useCallback(() => {
    mutate(unstable_serialize(getChatHistoryPaginationKey));
  }, [mutate]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    resumeStream,
    addToolApprovalResponse,
    regenerate,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    resume: id !== undefined && initialMessages.length > 0,
    transport: new ChatTransport({
      onStreamPart: (part) => {
        if (isNewChat && !didFetchHistoryOnNewChat.current) {
          fetchChatHistory();
          didFetchHistoryOnNewChat.current = true;
        }
        resumeAttemptCountRef.current = 0;
        setStreamCursor((cursor) => cursor + 1);
        setLastPart(part);
      },
      api: '/api/chat',
      fetch: fetchWithAbort,
      prepareSendMessagesRequest({ messages, id, body }) {
        const lastMessage = messages.at(-1);
        const isUserMessage = lastMessage?.role === 'user';
        const needsPreviousMessages = !chatHistoryEnabled || !isUserMessage;

        return {
          body: {
            id,
            ...(isUserMessage ? { message: lastMessage } : {}),
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityType,
            nextMessageId: generateUUID(),
            ...(needsPreviousMessages
              ? {
                  previousMessages: isUserMessage
                    ? messages.slice(0, -1)
                    : messages,
                }
              : {}),
            ...body,
          },
        };
      },
      prepareReconnectToStreamRequest({ id }) {
        return {
          api: `/api/chat/${id}/stream`,
          credentials: 'include',
          headers: {
            'X-Resume-Stream-Cursor': streamCursorRef.current.toString(),
          },
        };
      },
    }),
    onFinish: ({ isAbort, isDisconnect, isError }) => {
      didFetchHistoryOnNewChat.current = false;

      if (isAbort) {
        setStreamCursor(0);
        fetchChatHistory();
        return;
      }

      const streamIncomplete = lastPartRef.current?.type !== 'finish';
      const shouldResume =
        streamIncomplete &&
        (isDisconnect || isError || lastPartRef.current === undefined);

      if (shouldResume && resumeAttemptCountRef.current < maxResumeAttempts) {
        resumeAttemptCountRef.current++;
        resumeStream();
      } else {
        if (resumeAttemptCountRef.current >= maxResumeAttempts) {
          console.warn('[ChatPanel onFinish] Max resume attempts reached');
        }
        setStreamCursor(0);
        fetchChatHistory();
      }
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      } else {
        console.warn('[ChatPanel onError] Error during streaming:', error.message);
      }
    },
  });

  // Resize handling
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      setChatPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth)));
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
  }, [isResizing, setChatPanelWidth]);

  const [searchParams] = useSearchParams();
  const query = searchParams.get('query');
  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: query }],
      });
      setHasAppendedQuery(true);
      softNavigateToChatId(id, chatHistoryEnabled);
    }
  }, [query, sendMessage, hasAppendedQuery, id, chatHistoryEnabled]);

  // Extract text content from chat messages for PDF export
  const chatMessagesForExport = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      let content = '';
      if (m.parts) {
        for (const part of m.parts) {
          if (part.type === 'text') content += part.text;
        }
      }
      return { role: m.role, content, timestamp: m.createdAt };
    })
    .filter((m) => m.content.length > 0);

  return (
    <>
      {/* Hidden data bridge for PDF export */}
      <div
        className="chat-messages-data hidden"
        data-messages={JSON.stringify(chatMessagesForExport)}
      />
      {/* Floating Chat Button */}
      {!chatPanelOpen && (
        <button
          type="button"
          onClick={() => setChatPanelOpen(true)}
          className='fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF3621] text-white shadow-[#FF3621]/30 shadow-lg transition-all hover:scale-105 hover:bg-[#FF3621]/90 hover:shadow-[#FF3621]/40 hover:shadow-xl active:scale-95'
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Slide-in Chat Panel */}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex max-w-[90vw] flex-col border-white/10 border-r bg-[#0a0a14]/95 backdrop-blur-xl transition-transform duration-300 ease-in-out ${
          chatPanelOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: chatPanelWidth }}
      >
        {/* Resize Handle (right edge) */}
        <div
          className="group absolute top-0 right-0 z-50 flex h-full w-2 cursor-col-resize items-center justify-center hover:bg-white/10"
          onMouseDown={handleResizeStart}
        >
          <div className={`h-8 w-1 rounded-full transition-colors ${isResizing ? 'bg-[#FF3621]' : 'bg-white/20 group-hover:bg-white/40'}`} />
        </div>
        {/* Panel Header */}
        <div className="shrink-0 border-white/10 border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#FF3621]" />
              <span className="font-semibold text-sm text-white">Equity Analyst</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  navigate('/');
                  setShowHistory(false);
                }}
                title="New Chat"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 transition-colors ${showHistory ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                onClick={() => setShowHistory(!showHistory)}
                title="Chat History"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => setChatPanelOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chat History Dropdown */}
          {showHistory && (
            <div className="max-h-64 overflow-y-auto border-white/10 border-t bg-[#0a0a14]/80 px-2 py-2">
              {allChats.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-white/50">
                  {chatHistoryEnabled
                    ? 'No chat history yet'
                    : 'Chat history is disabled'}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {allChats.map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => {
                        navigate(`/chat/${chat.id}`);
                        setShowHistory(false);
                      }}
                      className={`w-full truncate rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        chat.id === id
                          ? 'bg-white/15 text-white'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {chat.title || 'Untitled Chat'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Messages - use min-h-0 to allow flex child to scroll */}
        <div className="flex min-h-0 flex-1 flex-col">
          <Messages
            chatId={id}
            status={status}
            messages={messages}
            setMessages={setMessages}
            addToolApprovalResponse={addToolApprovalResponse}
            regenerate={regenerate}
            sendMessage={sendMessage}
            isReadonly={isReadonly}
            selectedModelId={initialChatModel}
          />
        </div>

        {/* Chat Input */}
        {!isReadonly && (
          <div className="shrink-0 border-white/10 border-t bg-[#0a0a14]/60 px-3 py-3">
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              sendMessage={sendMessage}
              selectedVisibilityType={visibilityType}
            />
          </div>
        )}
      </div>

      {/* Backdrop overlay when panel is open (mobile only) */}
      {chatPanelOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setChatPanelOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setChatPanelOpen(false);
          }}
        />
      )}
    </>
  );
}
