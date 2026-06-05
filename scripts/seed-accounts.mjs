// Seed 5 accounts for user ffc67efd-1c09-483f-942b-c7ce6084d158, then backfill
// existing expenses (account_id IS NULL) with the Chase Credit Card account id.
// Usage: node scripts/seed-accounts.mjs
// Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Tiny .env.local loader (same pattern as setup-user.mjs).
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
const base = url.replace(/\/+$/, '');

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const accounts = [
  { user_id: USER_ID, name: 'Chase Checking',              type: 'checking',    current_balance: 1096.53, is_paycheck_destination: true,  is_vault: false, display_order: 1 },
  { user_id: USER_ID, name: 'BofA Checking',               type: 'checking',    current_balance: 2608.30, is_paycheck_destination: false, is_vault: false, display_order: 2 },
  { user_id: USER_ID, name: 'Marcus HYSA (Tuition Vault)', type: 'hysa',        current_balance: 2600.00, is_paycheck_destination: false, is_vault: true,  display_order: 3 },
  { user_id: USER_ID, name: 'Chase Credit Card',           type: 'credit_card', current_balance: 311.16,  is_paycheck_destination: false, is_vault: false, display_order: 4 },
  { user_id: USER_ID, name: 'BofA Credit Card',            type: 'credit_card', current_balance: 0.00,    is_paycheck_destination: false, is_vault: false, display_order: 5 },
];

// 1. Delete any existing accounts for this user (idempotent re-run).
const delRes = await fetch(`${base}/rest/v1/accounts?user_id=eq.${USER_ID}`, {
  method: 'DELETE',
  headers,
});
if (!delRes.ok) {
  console.error('Delete failed:', delRes.status, await delRes.text());
  process.exit(1);
}
const deleted = await delRes.json();
console.log(`Deleted ${Array.isArray(deleted) ? deleted.length : 0} pre-existing accounts.`);

// 2. Insert the 5 accounts.
const insRes = await fetch(`${base}/rest/v1/accounts`, {
  method: 'POST',
  headers,
  body: JSON.stringify(accounts),
});
if (!insRes.ok) {
  console.error('Insert failed:', insRes.status, await insRes.text());
  process.exit(1);
}
const inserted = await insRes.json();
console.log(`Inserted ${inserted.length} accounts:`);
for (const a of inserted) {
  console.log(`  ${a.display_order}. ${a.name.padEnd(32)} id=${a.id}  type=${a.type}  bal=${a.current_balance}`);
}

const chaseCc = inserted.find((a) => a.name === 'Chase Credit Card');
const chaseChecking = inserted.find((a) => a.name === 'Chase Checking');
if (!chaseCc) {
  console.error('Could not locate Chase Credit Card in inserted rows');
  process.exit(1);
}

// 3. Backfill expenses where account_id IS NULL.
const patchRes = await fetch(
  `${base}/rest/v1/expenses?user_id=eq.${USER_ID}&account_id=is.null`,
  {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ account_id: chaseCc.id }),
  }
);
if (!patchRes.ok) {
  console.error('Backfill PATCH failed:', patchRes.status, await patchRes.text());
  process.exit(1);
}
const patched = await patchRes.json();
console.log(`\nBackfilled ${patched.length} expenses with account_id=${chaseCc.id} (Chase Credit Card).`);

// 4. Verify: list accounts + list expenses with account_id set.
const accListRes = await fetch(
  `${base}/rest/v1/accounts?user_id=eq.${USER_ID}&select=id,name,type,current_balance,display_order&order=display_order.asc`,
  { headers }
);
const accList = await accListRes.json();
console.log(`\nVerify - accounts for user: ${accList.length}`);

const expListRes = await fetch(
  `${base}/rest/v1/expenses?user_id=eq.${USER_ID}&select=id,description,account_id&account_id=eq.${chaseCc.id}`,
  { headers }
);
const expList = await expListRes.json();
console.log(`Verify - expenses with Chase CC id: ${expList.length}`);

const allExpRes = await fetch(
  `${base}/rest/v1/expenses?user_id=eq.${USER_ID}&select=id,account_id`,
  { headers }
);
const allExp = await allExpRes.json();
console.log(`Verify - total expenses for user:  ${allExp.length}`);
console.log(`Verify - expenses still null:      ${allExp.filter((e) => e.account_id === null).length}`);

console.log(`\nDone. Chase Checking id: ${chaseChecking?.id}`);
console.log(`      Chase Credit Card id: ${chaseCc.id}`);
