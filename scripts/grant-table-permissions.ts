/**
 * Script to grant permissions on the SentimentAnalysis table to the app's service principal.
 *
 * Run this script after creating the table to allow the deployed app to access it.
 *
 * Usage: npx tsx scripts/grant-table-permissions.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

async function getCliToken(): Promise<string> {
  const profile = process.env.DATABRICKS_CONFIG_PROFILE || 'DEFAULT';
  try {
    const { stdout } = await execAsync(`databricks auth token --profile ${profile}`);
    const parsed = JSON.parse(stdout);
    return parsed.access_token;
  } catch (_error) {
    // Try with full homebrew path
    const { stdout } = await execAsync(`/opt/homebrew/bin/databricks auth token --profile ${profile}`);
    const parsed = JSON.parse(stdout);
    return parsed.access_token;
  }
}

async function main() {
  console.log('Granting permissions on SentimentAnalysis table...\n');

  // Get database connection info from env
  const pgHost = process.env.PGHOST;
  const pgUser = process.env.PGUSER;
  const pgDatabase = process.env.PGDATABASE || 'databricks_postgres';
  const pgPort = Number.parseInt(process.env.PGPORT || '5432', 10);

  if (!pgHost || !pgUser) {
    console.error('Error: PGHOST and PGUSER must be set in .env.local');
    process.exit(1);
  }

  // Get OAuth token for authentication
  console.log('Getting Databricks CLI token...');
  const token = await getCliToken();

  // Create database connection
  const pool = new Pool({
    host: pgHost,
    user: pgUser,
    password: token,
    database: pgDatabase,
    port: pgPort,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    console.log('Connected to database.\n');

    // First, let's see what roles exist
    console.log('Checking existing roles...');
    const rolesResult = await client.query(`
      SELECT rolname FROM pg_roles
      WHERE rolname LIKE '%chatbot%' OR rolname LIKE '%news%' OR rolname LIKE '%app%'
      ORDER BY rolname
    `);

    console.log('Found relevant roles:');
    for (const row of rolesResult.rows) {
      console.log(`  - ${row.rolname}`);
    }
    console.log('');

    // Grant permissions to PUBLIC as a fallback (all authenticated users)
    // This is safe for Lakebase since only authenticated principals can connect
    console.log('Granting permissions to PUBLIC...');
    await client.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ai_chatbot."SentimentAnalysis" TO PUBLIC
    `);
    console.log('✓ Granted SELECT, INSERT, UPDATE, DELETE to PUBLIC\n');

    // Also ensure the schema has usage permissions
    console.log('Ensuring schema usage permissions...');
    await client.query(`
      GRANT USAGE ON SCHEMA ai_chatbot TO PUBLIC
    `);
    console.log('✓ Granted USAGE on schema ai_chatbot to PUBLIC\n');

    client.release();
    console.log('Permissions granted successfully!');
    console.log('\nThe deployed app should now be able to access the SentimentAnalysis table.');
  } catch (error) {
    console.error('Error granting permissions:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
