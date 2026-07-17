// One-shot: set flow_overrides.bofa_overflow = "300" on the Jul 17 NTT paycheck.
// Preserves any other keys in flow_overrides. Uses service-role REST like
// update-vault-cap.mjs. Safe to re-run — it merges instead of replacing.

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env / .env.local');
  process.exit(1);
}

const USER_ID = 'ffc67efd-1c09-483f-942b-c7ce6084d158';
const PAY_DATE = '2026-07-17';
const OVERRIDE_KEY = 'bofa_overflow';
const OVERRIDE_VALUE = '300';

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const base = url.replace(/\/+$/, '');

// 1. Fetch current flow_overrides for the target row.
const getRes = await fetch(
  `${base}/rest/v1/paychecks?user_id=eq.${USER_ID}&pay_date=eq.${PAY_DATE}&select=id,pay_num,pay_date,employer,flow_overrides`,
  { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
);
if (!getRes.ok) {
  console.error('GET failed:', getRes.status, await getRes.text());
  process.exit(1);
}
const rows = await getRes.json();
if (rows.length === 0) {
  console.error(`No paycheck found for pay_date=${PAY_DATE}`);
  process.exit(1);
}
if (rows.length > 1) {
  console.error(`Multiple paychecks matched pay_date=${PAY_DATE}, aborting.`);
  console.error(rows);
  process.exit(1);
}
const row = rows[0];
console.log('Target row:', JSON.stringify(row, null, 2));

const current = row.flow_overrides ?? {};
const next = { ...current, [OVERRIDE_KEY]: OVERRIDE_VALUE };

// 2. PATCH with merged overrides.
const patchRes = await fetch(
  `${base}/rest/v1/paychecks?id=eq.${row.id}&user_id=eq.${USER_ID}`,
  {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ flow_overrides: next }),
  },
);
if (!patchRes.ok) {
  console.error('PATCH failed:', patchRes.status, await patchRes.text());
  process.exit(1);
}
const patched = await patchRes.json();
console.log('PATCH result:', JSON.stringify(patched, null, 2));
