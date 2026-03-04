import {
  Router,
  type Request,
  type Response,
  type Router as RouterType,
} from 'express';
import { authMiddleware, requireAuth } from '../middleware/auth';
import {
  getDatabricksToken,
  getAuthMethod,
  getDatabricksUserIdentity,
  getCachedCliHost,
} from '@chat-template/auth';
import { getHostUrl } from '@chat-template/utils';

export const genieRouter: RouterType = Router();

genieRouter.use(authMiddleware);

// Cache for workspace hostname
let cachedHostname: string | null = null;

async function getWorkspaceHostname(): Promise<string> {
  if (cachedHostname) return cachedHostname;

  const authMethod = getAuthMethod();
  if (authMethod === 'cli') {
    await getDatabricksUserIdentity();
    const cliHost = getCachedCliHost();
    if (cliHost) {
      cachedHostname = cliHost;
      return cachedHostname;
    }
    throw new Error('CLI authentication succeeded but hostname was not cached');
  }
  cachedHostname = getHostUrl();
  return cachedHostname;
}

async function getToken(): Promise<string> {
  if (process.env.DATABRICKS_TOKEN) {
    return process.env.DATABRICKS_TOKEN;
  }
  return getDatabricksToken();
}

interface GenieAttachment {
  attachment_id?: string;
  text?: { content: string };
  query?: {
    query: string;
    description?: string;
    query_result_metadata?: { row_count: number };
    statement_id?: string;
  };
  suggested_questions?: { questions: string[] };
}

interface GenieMessageResponse {
  id: string;
  conversation_id: string;
  status: string;
  attachments?: GenieAttachment[];
  error?: { message: string };
}

// Poll for Genie message completion
async function pollForResult(
  hostname: string,
  token: string,
  roomId: string,
  conversationId: string,
  messageId: string,
  timeout = 120000,
  interval = 2000,
): Promise<GenieMessageResponse> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const res = await fetch(
      `${hostname}/api/2.0/genie/spaces/${roomId}/conversations/${conversationId}/messages/${messageId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Genie API error (${res.status}): ${errText}`);
    }

    const data: GenieMessageResponse = await res.json();

    if (data.status === 'COMPLETED') return data;
    if (data.status === 'FAILED') {
      throw new Error(data.error?.message || 'Genie query failed');
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error('Genie query timed out');
}

// Fetch query result table data
async function fetchQueryResult(
  hostname: string,
  token: string,
  roomId: string,
  conversationId: string,
  messageId: string,
  attachmentId: string,
): Promise<{ columns: { name: string; type: string }[]; rows: string[][]; rowCount: number } | null> {
  const res = await fetch(
    `${hostname}/api/2.0/genie/spaces/${roomId}/conversations/${conversationId}/messages/${messageId}/query-result/${attachmentId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) return null;

  const data = await res.json();
  const stmt = data.statement_response;
  if (!stmt || stmt.status?.state !== 'SUCCEEDED') return null;

  const columns = (stmt.manifest?.schema?.columns || []).map(
    (col: { name: string; type_name: string }) => ({
      name: col.name,
      type: col.type_name,
    }),
  );

  return {
    columns,
    rows: stmt.result?.data_array || [],
    rowCount: stmt.manifest?.total_row_count || 0,
  };
}

// Extract structured response from Genie message
function extractResponse(msg: GenieMessageResponse) {
  const attachments = msg.attachments || [];

  let answer = '';
  let sql = '';
  let queryAttachmentId = '';
  const suggestedQuestions: string[] = [];

  for (const att of attachments) {
    if (att.text?.content) {
      answer += (answer ? '\n\n' : '') + att.text.content;
    }
    if (att.query?.query) {
      sql = att.query.query;
      if (att.attachment_id) {
        queryAttachmentId = att.attachment_id;
      }
    }
    if (att.suggested_questions?.questions) {
      suggestedQuestions.push(...att.suggested_questions.questions);
    }
  }

  return { answer, sql, queryAttachmentId, suggestedQuestions };
}

/**
 * GET /api/genie/config - Check if Genie is configured
 */
genieRouter.get('/config', (_req: Request, res: Response) => {
  const roomId = process.env.DATABRICKS_GENIE_ROOM_ID;
  res.json({
    available: !!roomId,
    roomId: roomId || null,
  });
});

/**
 * POST /api/genie/ask - Start a new Genie conversation
 */
genieRouter.post('/ask', requireAuth, async (req: Request, res: Response) => {
  try {
    const { question, roomId: clientRoomId } = req.body;
    const roomId = clientRoomId || process.env.DATABRICKS_GENIE_ROOM_ID;

    if (!roomId) {
      return res.status(400).json({ error: 'Genie room ID not configured' });
    }
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    console.log('[Genie] Starting conversation in room:', roomId);
    console.log('[Genie] Question:', question);

    const token = await getToken();
    const hostname = await getWorkspaceHostname();

    // Start conversation
    const startRes = await fetch(
      `${hostname}/api/2.0/genie/spaces/${roomId}/start-conversation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: question }),
      },
    );

    if (!startRes.ok) {
      const errText = await startRes.text();
      console.error('[Genie] Start conversation failed:', errText);
      return res.status(startRes.status).json({ error: 'Failed to start Genie conversation', details: errText });
    }

    const startData = await startRes.json();
    const conversationId = startData.conversation?.id;
    const messageId = startData.message?.id;

    if (!conversationId || !messageId) {
      return res.status(500).json({ error: 'Invalid Genie response' });
    }

    console.log('[Genie] Conversation:', conversationId, 'Message:', messageId);

    // Poll for completion
    const result = await pollForResult(hostname, token, roomId, conversationId, messageId);
    const { answer, sql, queryAttachmentId, suggestedQuestions } = extractResponse(result);

    // Fetch table data if query was generated
    let table = null;
    if (queryAttachmentId) {
      table = await fetchQueryResult(hostname, token, roomId, conversationId, messageId, queryAttachmentId);
    }

    console.log('[Genie] Response ready. Has table:', !!table, 'Rows:', table?.rowCount || 0);

    res.json({
      conversationId,
      messageId,
      answer,
      sql: sql || undefined,
      table: table || undefined,
      suggestedQuestions: suggestedQuestions.length > 0 ? suggestedQuestions : undefined,
    });
  } catch (error) {
    console.error('[Genie] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/genie/follow-up - Follow up in existing conversation
 */
genieRouter.post('/follow-up', requireAuth, async (req: Request, res: Response) => {
  try {
    const { question, conversationId, roomId: clientRoomId } = req.body;
    const roomId = clientRoomId || process.env.DATABRICKS_GENIE_ROOM_ID;

    if (!roomId || !conversationId || !question) {
      return res.status(400).json({ error: 'roomId, conversationId, and question are required' });
    }

    console.log('[Genie] Follow-up in conversation:', conversationId);

    const token = await getToken();
    const hostname = await getWorkspaceHostname();

    // Send follow-up
    const followRes = await fetch(
      `${hostname}/api/2.0/genie/spaces/${roomId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: question }),
      },
    );

    if (!followRes.ok) {
      const errText = await followRes.text();
      console.error('[Genie] Follow-up failed:', errText);
      return res.status(followRes.status).json({ error: 'Failed to send follow-up', details: errText });
    }

    const followData = await followRes.json();
    const messageId = followData.id;

    if (!messageId) {
      return res.status(500).json({ error: 'Invalid Genie follow-up response' });
    }

    // Poll for completion
    const result = await pollForResult(hostname, token, roomId, conversationId, messageId);
    const { answer, sql, queryAttachmentId, suggestedQuestions } = extractResponse(result);

    // Fetch table data
    let table = null;
    if (queryAttachmentId) {
      table = await fetchQueryResult(hostname, token, roomId, conversationId, messageId, queryAttachmentId);
    }

    res.json({
      conversationId,
      messageId,
      answer,
      sql: sql || undefined,
      table: table || undefined,
      suggestedQuestions: suggestedQuestions.length > 0 ? suggestedQuestions : undefined,
    });
  } catch (error) {
    console.error('[Genie] Follow-up error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});
