// One-shot data fix:
//   A. Update Chase Credit Card arrival_balance from 51.34 → -42.16
//      (reflects metro pass charges already on the card but excluded
//       from the CO spending budget).
//   B. Insert two metro-pass expenses on Chase CC with count_in_co_budget=false:
//        - Metro monthly pass  $88.00  on 2026-05-26
//        - Metro daily pass    $ 5.50  on 2026-05-26
//   C. Verify: re-read arrival_balance + count Chase CC expenses.
//
// Usage: node scripts/fix-cc-arrival-and-metro.mjs

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
const base = url.replace(/\/+$/, '');
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

// --- A. PATCH Chase Credit Card arrival_balance ---
const patchRes = await fetch(
  `${base}/rest/v1/accounts?user_id=eq.${USER_ID}&name=eq.${encodeURIComponent('Chase Credit Card')}`,
  {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ arrival_balance: -42.16 }),
  },
);
if (!patchRes.ok) {
  console.error('PATCH Chase Credit Card arrival_balance failed:', patchRes.status, await patchRes.text());
  process.exit(1);
}
const patched = await patchRes.json();
if (!Array.isArray(patched) || patched.length === 0) {
  console.error('PATCH returned no rows — Chase Credit Card not found for user');
  process.exit(1);
}
const chaseCc = patched[0];
console.log(`PATCH Chase Credit Card: arrival_balance ${51.34} → ${chaseCc.arrival_balance} (id=${chaseCc.id})`);

// --- B. INSERT two metro-pass expenses with count_in_co_budget=false ---
const newExpenses = [
  {
    user_id: USER_ID,
    description: 'Metro monthly pass',
    amount: 88,
    expense_date: '2026-05-26',
    category: 'Transport',
    account_id: chaseCc.id,
    count_in_co_budget: false,
  },
  {
    user_id: USER_ID,
    description: 'Metro daily pass',
    amount: 5.50,
    expense_date: '2026-05-26',
    category: 'Transport',
    account_id: chaseCc.id,
    count_in_co_budget: false,
  },
];

const insRes = await fetch(`${base}/rest/v1/expenses`, {
  method: 'POST',
  headers,
  body: JSON.stringify(newExpenses),
});
if (!insRes.ok) {
  console.error('INSERT metro-pass expenses failed:', insRes.status, await insRes.text());
  process.exit(1);
}
const inserted = await insRes.json();
console.log(`INSERT ${inserted.length} metro-pass expense rows on Chase Credit Card:`);
for (const e of inserted) {
  console.log(`  - ${e.description}: $${e.amount} (${e.expense_date}, count_in_co_budget=${e.count_in_co_budget})`);
}

// --- C. Verify ---
const verifyAcctRes = await fetch(
  `${base}/rest/v1/accounts?user_id=eq.${USER_ID}&name=eq.${encodeURIComponent('Chase Credit Card')}&select=id,name,arrival_balance`,
  { headers },
);
const verifyAcct = await verifyAcctRes.json();
console.log(`\nVerify Chase Credit Card arrival_balance: ${verifyAcct[0]?.arrival_balance}`);

const verifyExpRes = await fetch(
  `${base}/rest/v1/expenses?user_id=eq.${USER_ID}&account_id=eq.${chaseCc.id}&select=id`,
  { headers: { ...headers, Prefer: 'count=exact' } },
);
const contentRange = verifyExpRes.headers.get('content-range');
const total = contentRange ? contentRange.split('/')[1] : '?';
console.log(`Verify Chase Credit Card expense count: ${total}`);

console.log('\nDone.');
