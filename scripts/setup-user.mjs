// One-shot admin helper: create or update a user with a known password and skip email confirmation.
// Usage: EMAIL='you@x.com' PASSWORD='secret' node scripts/setup-user.mjs
// Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env (loaded from .env.local).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Tiny .env.local loader (avoids adding dotenv just for this).
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.EMAIL;
const password = process.env.PASSWORD;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env / .env.local');
  process.exit(1);
}
if (!email || !password) {
  console.error("Set EMAIL and PASSWORD env vars. e.g. EMAIL='you@x.com' PASSWORD='secret' node scripts/setup-user.mjs");
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

const base = url.replace(/\/+$/, '');

// 1. Look up existing user by email.
const listRes = await fetch(`${base}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers });
if (!listRes.ok) {
  console.error('List users failed:', listRes.status, await listRes.text());
  process.exit(1);
}
const listJson = await listRes.json();
const existing = (listJson.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (existing) {
  console.log(`User exists: ${existing.id} — updating password + confirming email.`);
  const upd = await fetch(`${base}/auth/v1/admin/users/${existing.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ password, email_confirm: true }),
  });
  if (!upd.ok) {
    console.error('Update failed:', upd.status, await upd.text());
    process.exit(1);
  }
  const updated = await upd.json();
  console.log('Updated:', { id: updated.id, email: updated.email, confirmed_at: updated.email_confirmed_at ?? updated.confirmed_at });
} else {
  console.log('No user found — creating with email_confirm=true.');
  const cre = await fetch(`${base}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!cre.ok) {
    console.error('Create failed:', cre.status, await cre.text());
    process.exit(1);
  }
  const created = await cre.json();
  console.log('Created:', { id: created.id, email: created.email, confirmed_at: created.email_confirmed_at ?? created.confirmed_at });
}

console.log('\nDone. Sign in at /login → Password tab with the email + password you set.');
