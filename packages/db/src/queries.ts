import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  sql,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  chat,
  message,
  sentimentAnalysis,
  sectorNews,
  type DBMessage,
  type Chat,
} from './schema';
import type { VisibilityType } from '@chat-template/utils';
import { ChatSDKError } from '@chat-template/core/errors';
import type { LanguageModelV2Usage } from '@ai-sdk/provider';
import { isDatabaseAvailable } from './connection';
import { getAuthMethod, getAuthMethodDescription } from '@chat-template/auth';

// Re-export User type for external use
export type { User } from './schema';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle
let _db: ReturnType<typeof drizzle>;

const getOrInitializeDb = async () => {
  if (!isDatabaseAvailable()) {
    throw new Error(
      'Database configuration required. Please set PGDATABASE/PGHOST/PGUSER or POSTGRES_URL environment variables.',
    );
  }

  if (_db) return _db;

  const authMethod = getAuthMethod();
  if (authMethod === 'oauth' || authMethod === 'cli') {
    // Dynamic auth path - db will be initialized asynchronously
    console.log(
      `Using ${getAuthMethodDescription()} authentication for Postgres connection`,
    );
  } else if (process.env.POSTGRES_URL) {
    // Traditional connection string
    const client = postgres(process.env.POSTGRES_URL);
    _db = drizzle(client);
  }

  return _db;
};

// Helper to ensure db is initialized for dynamic auth connections
async function ensureDb() {
  const db = await getOrInitializeDb();
  // Always get a fresh DB instance for dynamic auth connections to handle token expiry
  const authMethod = getAuthMethod();
  if (authMethod === 'oauth' || authMethod === 'cli') {
    const authDescription = getAuthMethodDescription();
    console.log(`[ensureDb] Getting ${authDescription} database connection...`);
    try {
      // Import getDb for database connection
      const { getDb } = await import('./connection-pool.js');
      const database = await getDb();
      console.log(
        `[ensureDb] ${authDescription} db connection obtained successfully`,
      );
      return database;
    } catch (error) {
      console.error(
        `[ensureDb] Failed to get ${authDescription} connection:`,
        error,
      );
      throw error;
    }
  }

  // For static connections (POSTGRES_URL), use cached instance
  if (!db) {
    console.error('[ensureDb] DB is still null after initialization attempt!');
    throw new Error('Database connection could not be established');
  }
  return db;
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[saveChat] Database not available, skipping persistence');
    return;
  }

  try {
    return await (await ensureDb()).insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    console.error('[saveChat] Error saving chat:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  if (!isDatabaseAvailable()) {
    console.log('[deleteChatById] Database not available, skipping deletion');
    return null;
  }

  try {
    await (await ensureDb()).delete(message).where(eq(message.chatId, id));

    const [chatsDeleted] = await (await ensureDb())
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function deleteChatsByUserId({ userId }: { userId: string }) {
  if (!isDatabaseAvailable()) {
    console.log(
      '[deleteChatsByUserId] Database not available, skipping deletion',
    );
    return 0;
  }

  try {
    const db = await ensureDb();
    // First get all chat IDs for this user
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) return 0;

    const chatIds = userChats.map((c) => c.id);

    // Delete messages for all user chats
    await db.delete(message).where(inArray(message.chatId, chatIds));

    // Delete the chats themselves
    await db.delete(chat).where(eq(chat.userId, userId));

    return chatIds.length;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chats for user',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[getChatsByUserId] Database not available, returning empty');
    return { chats: [], hasMore: false };
  }

  try {
    const extendedLimit = limit + 1;

    const query = async (whereCondition?: SQL<any>) => {
      const database = await ensureDb();

      return database
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);
    };

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      console.log(
        '[getChatsByUserId] Fetching chat for startingAfter:',
        startingAfter,
      );
      const database = await ensureDb();
      const [selectedChat] = await database
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      console.log(
        '[getChatsByUserId] Fetching chat for endingBefore:',
        endingBefore,
      );
      const database = await ensureDb();
      const [selectedChat] = await database
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      console.log('[getChatsByUserId] Executing main query without pagination');
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;
    console.log(
      '[getChatsByUserId] Query successful, found',
      filteredChats.length,
      'chats',
    );

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    console.error('[getChatsByUserId] Error details:', error);
    console.error(
      '[getChatsByUserId] Error stack:',
      error instanceof Error ? error.stack : 'No stack available',
    );
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  if (!isDatabaseAvailable()) {
    console.log('[getChatById] Database not available, returning null');
    return null;
  }

  try {
    const [selectedChat] = await (await ensureDb())
      .select()
      .from(chat)
      .where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[saveMessages] Database not available, skipping persistence');
    return;
  }

  try {
    // Use upsert to handle both new messages and updates (e.g., MCP approval continuations)
    // When a message ID already exists, update its parts (which may have changed)
    // Using sql`excluded.X` to reference the values that would have been inserted
    return await (await ensureDb())
      .insert(message)
      .values(messages)
      .onConflictDoUpdate({
        target: message.id,
        set: {
          parts: sql`excluded.parts`,
          attachments: sql`excluded.attachments`,
        },
      });
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  if (!isDatabaseAvailable()) {
    console.log(
      '[getMessagesByChatId] Database not available, returning empty',
    );
    return [];
  }

  try {
    return await (await ensureDb())
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  if (!isDatabaseAvailable()) {
    console.log('[getMessageById] Database not available, returning empty');
    return [];
  }

  try {
    return await (await ensureDb())
      .select()
      .from(message)
      .where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  if (!isDatabaseAvailable()) {
    console.log(
      '[deleteMessagesByChatIdAfterTimestamp] Database not available, skipping deletion',
    );
    return;
  }

  try {
    const messagesToDelete = await (await ensureDb())
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      return await (await ensureDb())
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  if (!isDatabaseAvailable()) {
    console.log(
      '[updateChatVisiblityById] Database not available, skipping update',
    );
    return;
  }

  try {
    return await (await ensureDb())
      .update(chat)
      .set({ visibility })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store raw LanguageModelUsage to keep it simple
  context: LanguageModelV2Usage;
}) {
  if (!isDatabaseAvailable()) {
    console.log(
      '[updateChatLastContextById] Database not available, skipping update',
    );
    return;
  }

  try {
    return await (await ensureDb())
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn('Failed to update lastContext for chat', chatId, error);
    return;
  }
}

// Sentiment Analysis queries

export async function saveSentimentAnalysis({
  userId,
  headline,
  company,
  status,
  sentimentScore,
  confidence,
  confidencePercent,
  rationale,
}: {
  userId: string;
  headline: string;
  company: string | null;
  status: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
  confidence: string;
  confidencePercent: number;
  rationale: string | null;
}) {
  if (!isDatabaseAvailable()) {
    console.log(
      '[saveSentimentAnalysis] Database not available, skipping persistence',
    );
    return null;
  }

  try {
    const [result] = await (await ensureDb())
      .insert(sentimentAnalysis)
      .values({
        userId,
        headline,
        company,
        status,
        sentimentScore,
        confidence,
        confidencePercent,
        rationale,
        createdAt: new Date(),
      })
      .returning();
    return result;
  } catch (error) {
    console.error('[saveSentimentAnalysis] Error saving analysis:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save sentiment analysis',
    );
  }
}

export async function getSentimentAnalysesByUserId({
  userId,
  limit = 50,
}: {
  userId: string;
  limit?: number;
}) {
  if (!isDatabaseAvailable()) {
    console.log(
      '[getSentimentAnalysesByUserId] Database not available, returning empty',
    );
    return [];
  }

  try {
    return await (await ensureDb())
      .select()
      .from(sentimentAnalysis)
      .where(eq(sentimentAnalysis.userId, userId))
      .orderBy(desc(sentimentAnalysis.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('[getSentimentAnalysesByUserId] Error:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get sentiment analyses',
    );
  }
}

export async function deleteSentimentAnalysis({ id }: { id: string }) {
  if (!isDatabaseAvailable()) {
    console.log(
      '[deleteSentimentAnalysis] Database not available, skipping deletion',
    );
    return null;
  }

  try {
    const [deleted] = await (await ensureDb())
      .delete(sentimentAnalysis)
      .where(eq(sentimentAnalysis.id, id))
      .returning();
    return deleted;
  } catch (error) {
    console.error('[deleteSentimentAnalysis] Error:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete sentiment analysis',
    );
  }
}

export async function clearSentimentAnalysesByUserId({
  userId,
}: { userId: string }) {
  if (!isDatabaseAvailable()) {
    console.log(
      '[clearSentimentAnalysesByUserId] Database not available, skipping',
    );
    return;
  }

  try {
    await (await ensureDb())
      .delete(sentimentAnalysis)
      .where(eq(sentimentAnalysis.userId, userId));
  } catch (error) {
    console.error('[clearSentimentAnalysesByUserId] Error:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to clear sentiment analyses',
    );
  }
}

// Sector Intelligence queries

export async function saveSectorNewsItem(data: {
  sectorId: string;
  headline: string;
  source: string | null;
  relatedSymbols: string[];
  sentimentStatus: string;
  sentimentScore: number;
  confidence: string;
  confidencePercent: number;
  impactScore: number;
  rationale: string | null;
  analyzedAt: Date;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[saveSectorNewsItem] Database not available, skipping');
    return null;
  }

  try {
    const [result] = await (await ensureDb())
      .insert(sectorNews)
      .values(data)
      .returning();
    return result;
  } catch (error) {
    console.error('[saveSectorNewsItem] Error:', error);
    return null;
  }
}

export async function saveSectorNewsBatch(
  items: Array<{
    sectorId: string;
    headline: string;
    source: string | null;
    relatedSymbols: string[];
    sentimentStatus: string;
    sentimentScore: number;
    confidence: string;
    confidencePercent: number;
    impactScore: number;
    rationale: string | null;
    analyzedAt: Date;
  }>,
) {
  if (!isDatabaseAvailable()) {
    console.log('[saveSectorNewsBatch] Database not available, skipping');
    return [];
  }

  try {
    await (await ensureDb()).insert(sectorNews).values(items);
    return items;
  } catch (error) {
    console.error('[saveSectorNewsBatch] Error:', error);
    return [];
  }
}

export async function getTopSectorNews() {
  if (!isDatabaseAvailable()) {
    console.log('[getTopSectorNews] Database not available, returning empty');
    return [];
  }

  try {
    return await (await ensureDb())
      .select()
      .from(sectorNews)
      .orderBy(desc(sectorNews.impactScore))
      .limit(200);
  } catch (error) {
    console.error('[getTopSectorNews] Error:', error);
    return [];
  }
}

export async function getSectorNewsCount() {
  if (!isDatabaseAvailable()) {
    return 0;
  }

  try {
    const result = await (await ensureDb())
      .select({ count: sql<number>`count(*)` })
      .from(sectorNews);
    return Number(result[0]?.count ?? 0);
  } catch (error) {
    console.error('[getSectorNewsCount] Error:', error);
    return 0;
  }
}

export async function clearAllSectorNews() {
  if (!isDatabaseAvailable()) {
    return;
  }

  try {
    await (await ensureDb()).delete(sectorNews);
  } catch (error) {
    console.error('[clearAllSectorNews] Error:', error);
  }
}
