// Seed Supabase with the user's existing Excel data, bypassing RLS via service role.
// Usage: node scripts/seed-from-xlsx.mjs
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

// --- Parsing helpers (mirror src/app/settings/import-parse.ts) ---
function num(cell, fallback = 0) {
  if (!cell) return fallback;
  const v = cell.v;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

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
  return String(v);
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
const wb = XLSX.read(buffer, { type: 'buffer', cellNF: false, cellDates: true });

const inputs = wb.Sheets['Inputs'];
if (!inputs) {
  console.error('Missing "Inputs" sheet in workbook');
  process.exit(1);
}

const settings = {
  vault_cap: num(cellOf(inputs, 'B6')),
  rent_monthly: num(cellOf(inputs, 'B11')),
  rent_months: Math.round(num(cellOf(inputs, 'B12'))),
  robinhood_weekly: num(cellOf(inputs, 'B13')),
  usc_gross_baseline: num(cellOf(inputs, 'B16')),
  usc_net_pct: num(cellOf(inputs, 'B17')),
  ntt_hourly_rate: num(cellOf(inputs, 'B18')),
  ntt_net_pct: num(cellOf(inputs, 'B20')),
  usc_no_rent_vault: num(cellOf(inputs, 'B35')),
  usc_rent_vault: num(cellOf(inputs, 'B45')),
};

const plan = wb.Sheets['Paycheck Plan'];
if (!plan) {
  console.error('Missing "Paycheck Plan" sheet in workbook');
  process.exit(1);
}

const paychecks = [];
for (let r = 5; r <= 18; r++) {
  const aCell = cellOf(plan, `A${r}`);
  const bCell = cellOf(plan, `B${r}`);
  const cCell = cellOf(plan, `C${r}`);
  if (!aCell || !bCell || !cCell) continue;

  const payNum = Math.round(num(aCell));
  const payDate = dateStr(bCell);
  const employer = str(cCell);
  if (!payDate || !employer) continue;

  const iCell = cellOf(plan, `I${r}`);
  const vaultOverride =
    iCell && !iCell.f && typeof iCell.v === 'number' ? iCell.v : null;

  paychecks.push({
    user_id: USER_ID,
    pay_num: payNum,
    pay_date: payDate,
    employer,
    hours_worked: numOrNull(cellOf(plan, `D${r}`)),
    actual_net_wages: numOrNull(cellOf(plan, `H${r}`)),
    vault_override: vaultOverride,
    rent_paid: num(cellOf(plan, `J${r}`)),
    per_diem: num(cellOf(plan, `T${r}`)),
    extra_deposit: num(cellOf(plan, `Q${r}`)),
    ot_hours: num(cellOf(plan, `S${r}`)),
    notes: str(cellOf(plan, `N${r}`)),
  });
}

console.log(`Parsed settings:`, settings);
console.log(`Parsed ${paychecks.length} paychecks.`);

// --- 1) Upsert settings via PATCH ---
const patchUrl = `${base}/rest/v1/settings?user_id=eq.${USER_ID}`;
const patchRes = await fetch(patchUrl, {
  method: 'PATCH',
  headers: { ...headers, Prefer: 'return=representation' },
  body: JSON.stringify(settings),
});
if (!patchRes.ok) {
  console.error('Settings PATCH failed:', patchRes.status, await patchRes.text());
  process.exit(1);
}
const patchedSettings = await patchRes.json();
console.log(`Settings updated. Row count: ${patchedSettings.length}`);
if (patchedSettings.length) {
  console.log('  vault_cap:', patchedSettings[0].vault_cap);
  console.log('  usc_net_pct:', patchedSettings[0].usc_net_pct);
  console.log('  ntt_net_pct:', patchedSettings[0].ntt_net_pct);
}

// --- 2) Delete existing paychecks for user ---
const delUrl = `${base}/rest/v1/paychecks?user_id=eq.${USER_ID}`;
const delRes = await fetch(delUrl, {
  method: 'DELETE',
  headers: { ...headers, Prefer: 'return=representation' },
});
if (!delRes.ok) {
  console.error('Paychecks DELETE failed:', delRes.status, await delRes.text());
  process.exit(1);
}
const deleted = await delRes.json();
console.log(`Deleted ${deleted.length} existing paychecks.`);

// --- 3) Insert new paychecks ---
const insUrl = `${base}/rest/v1/paychecks`;
const insRes = await fetch(insUrl, {
  method: 'POST',
  headers: { ...headers, Prefer: 'return=representation' },
  body: JSON.stringify(paychecks),
});
if (!insRes.ok) {
  console.error('Paychecks INSERT failed:', insRes.status, await insRes.text());
  process.exit(1);
}
const inserted = await insRes.json();
console.log(`Inserted ${inserted.length} new paychecks.`);

console.log('\nDone.');
