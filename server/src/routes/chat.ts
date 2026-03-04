import {
  Router,
  type Request,
  type Response,
  type Router as RouterType,
} from 'express';
import {
  convertToModelMessages,
  createUIMessageStream,
  streamText,
  pipeUIMessageStreamToResponse,
} from 'ai';
import {
  authMiddleware,
  requireAuth,
  requireChatAccess,
} from '../middleware/auth';
import {
  deleteChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatVisiblityById,
  isDatabaseAvailable,
} from '@chat-template/db';
import {
  type ChatMessage,
  checkChatAccess,
  convertToUIMessages,
  generateUUID,
  postRequestBodySchema,
  type PostRequestBody,
  type VisibilityType,
  myProvider,
  StreamCache,
  CONTEXT_HEADER_CONVERSATION_ID,
  CONTEXT_HEADER_USER_ID,
} from '@chat-template/core';
import { ChatSDKError } from '@chat-template/core/errors';

export const chatRouter: RouterType = Router();

const streamCache = new StreamCache();

// Apply auth middleware to all chat routes
chatRouter.use(authMiddleware);

// Helper function to generate title from user message
async function generateTitleFromUserMessage({
  message,
}: {
  message: ChatMessage;
}): Promise<string> {
  // Extract text from message parts
  const textParts = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => 'text' in part ? part.text : '')
    .join(' ');

  // Simple title generation - take first 50 chars
  const title = textParts.slice(0, 50).trim();
  return title || 'New Chat';
}

/**
 * POST /api/chat - Send a message and get streaming response
 *
 * Note: Works in ephemeral mode when database is disabled.
 */
chatRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const dbAvailable = isDatabaseAvailable();
  if (!dbAvailable) {
    console.log('[Chat] Running in ephemeral mode - no persistence');
  }

  console.log(`CHAT POST REQUEST ${Date.now()}`);

  let requestBody: PostRequestBody;

  try {
    requestBody = postRequestBodySchema.parse(req.body);
  } catch (_) {
    console.error('Error parsing request body:', _);
    const error = new ChatSDKError('bad_request:api');
    const response = error.toResponse();
    return res.status(response.status).json(response.json);
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message?: ChatMessage;
      selectedChatModel: string;
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = req.session;
    if (!session) {
      const error = new ChatSDKError('unauthorized:chat');
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    const { chat, allowed, reason } = await checkChatAccess(
      id,
      session?.user.id,
    );

    if (reason !== 'not_found' && !allowed) {
      const error = new ChatSDKError('forbidden:chat');
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    if (!chat) {
      // Only create new chat if we have a message (not a continuation)
      if (isDatabaseAvailable() && message) {
        const title = await generateTitleFromUserMessage({ message });

        await saveChat({
          id,
          userId: session.user.id,
          title,
          visibility: selectedVisibilityType,
        });
      }
    } else {
      if (chat.userId !== session.user.id) {
        const error = new ChatSDKError('forbidden:chat');
        const response = error.toResponse();
        return res.status(response.status).json(response.json);
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });

    // Use previousMessages from request body when:
    // 1. Ephemeral mode (DB not available) - always use client-side messages
    // 2. Continuation request (no message) - tool results only exist client-side
    const useClientMessages =
      !dbAvailable || (!message && requestBody.previousMessages);
    const previousMessages = useClientMessages
      ? (requestBody.previousMessages ?? [])
      : convertToUIMessages(messagesFromDb);

    // If message is provided, add it to the list and save it
    let uiMessages: ChatMessage[];
    if (message) {
      uiMessages = [...previousMessages, message];
      if (dbAvailable) {
        await saveMessages({
          messages: [
            {
              chatId: id,
              id: message.id,
              role: 'user',
              parts: message.parts,
              attachments: [],
              createdAt: new Date(),
              metadata: {},
            },
          ],
        });
      }
    } else {
      // Continuation: use existing messages without adding new user message
      uiMessages = previousMessages as ChatMessage[];
    }

    // Clear any previous active stream for this chat
    streamCache.clearActiveStream(id);

    const streamId = generateUUID();

    const model = await myProvider.languageModel(selectedChatModel);
    const result = streamText({
      model,
      messages: await convertToModelMessages(uiMessages),
      headers: {
        [CONTEXT_HEADER_CONVERSATION_ID]: id,
        [CONTEXT_HEADER_USER_ID]: session.user.email ?? session.user.id,
      },
    });

    /**
     * We manually create the stream to have access to the stream writer.
     * This allows us to inject custom stream parts like data-error.
     */
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.merge(
          result.toUIMessageStream({
            originalMessages: uiMessages,
            generateMessageId: generateUUID,
            sendReasoning: true,
            sendSources: true,
            onError: (error) => {
              console.error('Stream error:', error);

              const errorMessage =
                error instanceof Error ? error.message : JSON.stringify(error);

              writer.write({ type: 'data-error', data: errorMessage });

              return errorMessage;
            },
          }),
        );
      },
      onFinish: async ({ responseMessage }) => {
        console.log(
          'Finished message stream! Saving message...',
          JSON.stringify(responseMessage, null, 2),
        );
        if (dbAvailable) {
          await saveMessages({
            messages: [
              {
                id: responseMessage.id,
                role: responseMessage.role,
                parts: responseMessage.parts,
                createdAt: new Date(),
                attachments: [],
                chatId: id,
              },
            ],
          });
        }

        streamCache.clearActiveStream(id);
      },
    });

    pipeUIMessageStreamToResponse({
      stream,
      response: res,
      consumeSseStream({ stream }) {
        streamCache.storeStream({
          streamId,
          chatId: id,
          stream,
        });
      },
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    console.error('Unhandled error in chat API:', error);

    const chatError = new ChatSDKError('offline:chat');
    const response = chatError.toResponse();
    return res.status(response.status).json(response.json);
  }
});

/**
 * GET /api/chat/:id/stream - Resume a stream
 */
chatRouter.get(
  '/:id/stream',
  [requireAuth],
  async (req: Request, res: Response) => {
    const chatId = req.params.id;
    const cursor = req.headers['x-resume-stream-cursor'] as string;

    console.log(`[Stream Resume] Cursor: ${cursor}`);
    console.log(`[Stream Resume] GET request for chat ${chatId}`);

    // Check if there's an active stream for this chat first
    const streamId = streamCache.getActiveStreamId(chatId);

    if (!streamId) {
      console.log(`[Stream Resume] No active stream for chat ${chatId}`);
      const streamError = new ChatSDKError('empty:stream');
      const response = streamError.toResponse();
      return res.status(response.status).json(response.json);
    }

    const { allowed, reason } = await checkChatAccess(
      chatId,
      req.session?.user.id,
    );

    // If chat doesn't exist in DB, it's a temporary chat from the homepage - allow it
    if (reason === 'not_found') {
      console.log(
        `[Stream Resume] Resuming stream for temporary chat ${chatId} (not yet in DB)`,
      );
    } else if (!allowed) {
      console.log(
        `[Stream Resume] User ${req.session?.user.id} does not have access to chat ${chatId} (reason: ${reason})`,
      );
      const streamError = new ChatSDKError('forbidden:chat', reason);
      const response = streamError.toResponse();
      return res.status(response.status).json(response.json);
    }

    // Get all cached chunks for this stream
    const stream = streamCache.getStream(streamId, {
      cursor: cursor ? Number.parseInt(cursor) : undefined,
    });

    if (!stream) {
      console.log(`[Stream Resume] No stream found for ${streamId}`);
      const streamError = new ChatSDKError('empty:stream');
      const response = streamError.toResponse();
      return res.status(response.status).json(response.json);
    }

    console.log(`[Stream Resume] Resuming stream ${streamId}`);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Pipe the cached stream directly to the response
    stream.pipe(res);

    // Handle stream errors
    stream.on('error', (error) => {
      console.error('[Stream Resume] Stream error:', error);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
  },
);

/**
 * DELETE /api/chat?id=:id - Delete a chat
 */
chatRouter.delete(
  '/:id',
  [requireAuth, requireChatAccess],
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const deletedChat = await deleteChatById({ id });
    return res.status(200).json(deletedChat);
  },
);

/**
 * GET /api/chat/:id
 */

chatRouter.get(
  '/:id',
  [requireAuth, requireChatAccess],
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const { chat } = await checkChatAccess(id, req.session?.user.id);

    return res.status(200).json(chat);
  },
);

/**
 * POST /api/chat/title - Generate title from message
 */
chatRouter.post('/title', requireAuth, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const title = await generateTitleFromUserMessage({ message });
    res.json({ title });
  } catch (error) {
    console.error('Error generating title:', error);
    res.status(500).json({ error: 'Failed to generate title' });
  }
});

/**
 * PATCH /api/chat/:id/visibility - Update chat visibility
 */
chatRouter.patch(
  '/:id/visibility',
  [requireAuth, requireChatAccess],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { visibility } = req.body;

      if (!visibility || !['public', 'private'].includes(visibility)) {
        return res.status(400).json({ error: 'Invalid visibility type' });
      }

      await updateChatVisiblityById({ chatId: id, visibility });
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating visibility:', error);
      res.status(500).json({ error: 'Failed to update visibility' });
    }
  },
);
