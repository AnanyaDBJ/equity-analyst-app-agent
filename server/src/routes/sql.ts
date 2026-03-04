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

export const sqlRouter: RouterType = Router();

sqlRouter.use(authMiddleware);

// Cache for workspace hostname
let cachedHostname: string | null = null;

// Get workspace hostname with caching
async function getWorkspaceHostname(): Promise<string> {
  if (cachedHostname) {
    return cachedHostname;
  }

  const authMethod = getAuthMethod();

  if (authMethod === 'cli') {
    await getDatabricksUserIdentity();
    const cliHost = getCachedCliHost();
    if (cliHost) {
      cachedHostname = cliHost;
      return cachedHostname;
    }
    throw new Error('CLI authentication succeeded but hostname was not cached');
  } else {
    cachedHostname = getHostUrl();
    return cachedHostname;
  }
}

// Get SQL warehouse configuration
sqlRouter.get('/config', (_req: Request, res: Response) => {
  const warehouseId = process.env.DATABRICKS_SQL_WAREHOUSE_ID;
  res.json({
    warehouseId: warehouseId || null,
    available: !!warehouseId,
  });
});

// Execute SQL query
sqlRouter.post('/execute', requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, limit = 100 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const warehouseId = process.env.DATABRICKS_SQL_WAREHOUSE_ID;
    console.log('[SQL] Warehouse ID:', warehouseId);

    if (!warehouseId) {
      console.error('[SQL] DATABRICKS_SQL_WAREHOUSE_ID not set');
      return res.status(500).json({ error: 'SQL warehouse not configured' });
    }

    // Get auth token
    let token: string;
    try {
      if (process.env.DATABRICKS_TOKEN) {
        token = process.env.DATABRICKS_TOKEN;
      } else {
        token = await getDatabricksToken();
      }
    } catch (error) {
      console.error('[SQL] Failed to get Databricks token:', error);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Get workspace hostname
    let hostname: string;
    try {
      hostname = await getWorkspaceHostname();
      console.log('[SQL] Hostname:', hostname);
    } catch (error) {
      console.error('[SQL] Failed to get workspace hostname:', error);
      return res.status(500).json({ error: 'Failed to determine workspace' });
    }

    // Add LIMIT to query if not present
    let finalQuery = query.trim();
    if (!finalQuery.toLowerCase().includes('limit')) {
      finalQuery = `${finalQuery} LIMIT ${limit}`;
    }

    console.log('[SQL] Executing query:', finalQuery);

    // Execute SQL using Statement Execution API
    const url = `${hostname}/api/2.0/sql/statements`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        warehouse_id: warehouseId,
        statement: finalQuery,
        wait_timeout: '30s',
        on_wait_timeout: 'CANCEL',
      }),
    });

    console.log('[SQL] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SQL] API error:', response.status, errorText);
      return res.status(response.status).json({ error: 'Failed to execute query', details: errorText });
    }

    const result = await response.json();
    console.log('[SQL] Statement status:', result.status?.state);

    // Check if query succeeded
    if (result.status?.state === 'FAILED') {
      console.error('[SQL] Query failed:', result.status?.error);
      return res.status(400).json({
        error: 'Query execution failed',
        details: result.status?.error?.message || 'Unknown error'
      });
    }

    // Extract columns and data
    const columns = result.manifest?.schema?.columns?.map((col: { name: string; type_name: string }) => ({
      name: col.name,
      type: col.type_name,
    })) || [];

    const rows = result.result?.data_array || [];

    console.log('[SQL] Returned', rows.length, 'rows with', columns.length, 'columns');

    res.json({
      columns,
      rows,
      rowCount: rows.length,
      truncated: result.manifest?.truncated || false,
    });
  } catch (error) {
    console.error('[SQL] Error executing query:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch table data (convenience endpoint)
sqlRouter.get('/table/:catalog/:schema/:table', requireAuth, async (req: Request, res: Response) => {
  const { catalog, schema, table } = req.params;
  const limit = Number.parseInt(req.query.limit as string) || 100;

  const query = `SELECT * FROM ${catalog}.${schema}.${table} LIMIT ${limit}`;

  // Reuse the execute endpoint logic
  req.body = { query, limit };

  // Forward to execute
  const executeHandler = sqlRouter.stack.find(
    (layer: { route?: { path: string } }) => layer.route?.path === '/execute'
  );

  if (executeHandler) {
    return executeHandler.route.stack[0].handle(req, res);
  }

  res.status(500).json({ error: 'Execute handler not found' });
});
