// Seed Supabase expenses table from the "Expense Tracker" sheet of the user's xlsx.
// Usage: node scripts/seed-expenses.mjs
// Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as XLSX from 'xlsx';

// Tiny .env.local loader (same pattern as scripts/setup-user.mjs).
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
const XLSX_PATH = '/Users/dhairyashah5/Downloads/Summer_2026_Net_Paycheck_Allocation_Planner.xlsx';

const base = url.replace(/\/+$/, '');
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

// --- Parsing helpers ---
function numOrNull(cell) {
  if (!cell) return null;
  const v = cell.v;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(cell) {
  if (!cell) return null;
  const v = cell.v;
  if (typeof v === 'string') return v.trim() || null;
  if (v == null) return null;
  return String(v).trim() || null;
}

function dateStr(cell) {
  if (!cell) return null;
  const v = cell.v;
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'string') return v.slice(0, 10);
  return null;
}

function cellOf(sheet, addr) {
  return sheet[addr];
}

// --- Parse workbook ---
const buffer = readFileSync(XLSX_PATH);
const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

const sheet = wb.Sheets['Expense Tracker'];
if (!sheet) {
  console.error('Missing "Expense Tracker" sheet in workbook');
  console.error('Available sheets:', wb.SheetNames);
  process.exit(1);
}

const expenses = [];
const skipped = [];
let consecutiveEmpty = 0;

for (let r = 8; r <= 200; r++) {
  const aCell = cellOf(sheet, `A${r}`);
  const bCell = cellOf(sheet, `B${r}`);
  const cCell = cellOf(sheet, `C${r}`);
  const eCell = cellOf(sheet, `E${r}`);

  const isEmpty = !aCell && !bCell && !cCell && !eCell;
  if (isEmpty) {
    consecutiveEmpty++;
    if (consecutiveEmpty >= 3) break;
    continue;
  }
  consecutiveEmpty = 0;

  const amount = numOrNull(eCell);
  const description = str(cCell);

  // Skip rows where col E is empty/null/0 or col C is empty
  if (amount == null || amount === 0) {
    skipped.push({ row: r, reason: 'amount empty/zero', description, amount });
    continue;
  }
  if (!description) {
    skipped.push({ row: r, reason: 'description empty', description, amount });
    continue;
  }

  const expense_date = dateStr(aCell);
  if (!expense_date) {
    skipped.push({ row: r, reason: 'date missing', description, amount });
    continue;
  }

  const category = str(bCell);

  expenses.push({
    user_id: USER_ID,
    expense_date,
    description,
    amount,
    category,
  });
}

console.log(`Parsed ${expenses.length} expenses from "Expense Tracker".`);
if (skipped.length) {
  console.log(`Skipped ${skipped.length} rows:`);
  for (const s of skipped) console.log(' ', s);
}

if (expenses.length === 0) {
  console.error('No expenses parsed — aborting.');
  process.exit(1);
}

// --- 1) Delete existing expenses for user ---
const delUrl = `${base}/rest/v1/expenses?user_id=eq.${USER_ID}`;
const delRes = await fetch(delUrl, {
  method: 'DELETE',
  headers: { ...headers, Prefer: 'return=representation' },
});
if (!delRes.ok) {
  console.error('Expenses DELETE failed:', delRes.status, await delRes.text());
  process.exit(1);
}
const deleted = await delRes.json();
console.log(`Deleted ${deleted.length} existing expenses.`);

// --- 2) Insert all parsed expenses in one POST ---
const insUrl = `${base}/rest/v1/expenses`;
const insRes = await fetch(insUrl, {
  method: 'POST',
  headers: { ...headers, Prefer: 'return=representation' },
  body: JSON.stringify(expenses),
});
if (!insRes.ok) {
  console.error('Expenses INSERT failed:', insRes.status, await insRes.text());
  process.exit(1);
}
const inserted = await insRes.json();
console.log(`Inserted ${inserted.length} new expenses.`);

// --- 3) Verify with count ---
const countUrl = `${base}/rest/v1/expenses?user_id=eq.${USER_ID}&select=count`;
const countRes = await fetch(countUrl, {
  headers: { ...headers, Prefer: 'count=exact' },
});
if (!countRes.ok) {
  console.error('Count GET failed:', countRes.status, await countRes.text());
  process.exit(1);
}
const countJson = await countRes.json();
console.log('Count response:', countJson);

// --- 4) Logs sample + date range ---
const sorted = [...inserted].sort((a, b) => a.expense_date.localeCompare(b.expense_date));
const earliest = sorted[0]?.expense_date ?? null;
const latest = sorted[sorted.length - 1]?.expense_date ?? null;

console.log('\n--- SUMMARY ---');
console.log(`expenses_inserted: ${inserted.length}`);
console.log(`earliest_date: ${earliest}`);
console.log(`latest_date: ${latest}`);
console.log('Sample (first 3):');
for (const e of inserted.slice(0, 3)) {
  console.log(`  ${e.expense_date} | ${e.description} | $${e.amount} | ${e.category}`);
}

console.log('\nDone.');
