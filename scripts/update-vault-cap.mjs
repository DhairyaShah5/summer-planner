// One-shot helper: PATCH settings.vault_cap to 20000 via service-role REST.
// Env loaded from .env.local like setup-user.mjs.

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
const NEW_CAP = 20000;

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const base = url.replace(/\/+$/, '');

const patchRes = await fetch(`${base}/rest/v1/settings?user_id=eq.${USER_ID}`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ vault_cap: NEW_CAP }),
});
if (!patchRes.ok) {
  console.error('PATCH failed:', patchRes.status, await patchRes.text());
  process.exit(1);
}
const patchJson = await patchRes.json();
console.log('PATCH result:', JSON.stringify(patchJson, null, 2));

const getRes = await fetch(`${base}/rest/v1/settings?user_id=eq.${USER_ID}&select=user_id,vault_cap`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
});
if (!getRes.ok) {
  console.error('GET failed:', getRes.status, await getRes.text());
  process.exit(1);
}
const getJson = await getRes.json();
console.log('GET result:', JSON.stringify(getJson, null, 2));
