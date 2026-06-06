// One-shot helper: seed projected per_diem for each NTT paycheck.
//
// Per diem is $30/day × 5 weekdays/week, and lands one paycheck behind hours
// (hours approved one week prior to paycheck date). First per-diem payout is
// Jun 19 (covers May 28 – Jun 12 = 12 weekdays = $360). Every biweekly NTT
// check after that covers 10 weekdays = $300.
//
// Jun 5 NTT stays at $0 (pre-per-diem partial check).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

try {
  const here = dirname(fileURLToPath(import.meta.url));
  const text = readFileSync(join(here, '..', '.env.local'), 'utf8');
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
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const USER_ID = 'ffc67efd-1c09-483f-942b-c7ce6084d158';

// pay_num → per_diem amount
const UPDATES = [
  { pay_num: 4, per_diem: 360 }, // Jun 19 — 12 days (May 28 – Jun 12)
  { pay_num: 6, per_diem: 300 }, // Jul 3
  { pay_num: 8, per_diem: 300 }, // Jul 17
  { pay_num: 10, per_diem: 300 }, // Jul 31
  { pay_num: 12, per_diem: 300 }, // Aug 14
  { pay_num: 14, per_diem: 300 }, // Aug 28
];

const base = url.replace(/\/+$/, '');
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

for (const { pay_num, per_diem } of UPDATES) {
  const res = await fetch(
    `${base}/rest/v1/paychecks?user_id=eq.${USER_ID}&pay_num=eq.${pay_num}`,
    { method: 'PATCH', headers, body: JSON.stringify({ per_diem }) },
  );
  if (!res.ok) {
    console.error(`PATCH pay_num=${pay_num} failed:`, res.status, await res.text());
    process.exit(1);
  }
  const json = await res.json();
  console.log(`pay_num=${pay_num} → per_diem=${per_diem} (pay_date=${json[0]?.pay_date})`);
}

console.log('\nDone. Total seeded per diem: $' + UPDATES.reduce((s, u) => s + u.per_diem, 0));
