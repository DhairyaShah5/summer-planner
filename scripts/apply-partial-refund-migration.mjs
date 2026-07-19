// One-shot: add refund_expected + refund_settled columns to expenses.
// Uses the Postgres direct connection (POSTGRES_URL / SUPABASE_DB_URL) if set,
// otherwise falls back to the Supabase Data API via a raw SQL RPC (won't work
// without such an RPC — in that case, run the SQL manually in Supabase Studio).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

try {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = join(here, '..', '.env.local');
  const text = readFileSync(envPath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {}

const SQL = `
alter table public.expenses
  add column if not exists refund_expected numeric(10,2),
  add column if not exists refund_settled boolean not null default false;
`.trim();

const pgUrl =
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL;

if (pgUrl) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: pgUrl });
  await client.connect();
  console.log('Running migration against Postgres…');
  const res = await client.query(SQL);
  console.log('Result:', res.command ?? 'ok');
  await client.end();
  process.exit(0);
}

console.log(
  'No POSTGRES_URL / SUPABASE_DB_URL / DATABASE_URL in env.\n' +
    'Copy the SQL below into Supabase Studio → SQL Editor and run it:\n\n' +
    SQL,
);
