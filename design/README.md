# Handoff: Summer Planner — UI/UX Redesign

## Overview
A full visual + interaction redesign of **Summer Planner** (the production Next.js paycheck-allocation + expense tracker). Same routes, same data, same functionality — a cleaner, motion-rich, responsive UI. Routes: Dashboard, Paychecks ("Paycheck Plan"), Expenses, Accounts, Weekly ("Weekly Tracker"), Settings.

The redesign was rebuilt **against the real production app** (from live screenshots), so the layouts, columns, and numbers match what's in Supabase today. The values in these files are illustrative copies of real data and reconcile exactly (e.g. Vault $2,600 = $600 + $2,000 extra deposit; all 14 paychecks' vault allocations + extra deposits = exactly $20,000).

---

## ⚠️ Most important instruction
**Wire the UI to the data ALREADY in Supabase. Do NOT change the database.**
- Read the existing `settings`, `paychecks`, `expenses` rows (RLS-scoped by `auth.uid()`) through the app's existing react-query hooks / Supabase client.
- Do **not** add/alter/drop tables, columns, RLS policies, or rows. No migrations, no seed edits. Read-only.
- Keep **`src/lib/calc.ts`** as the source of truth for all computed columns (Gross Pay, Net %, Vault, Rent, RH, CO Spend, BofA, buffer, projections). The demo `data.js` only re-derives an approximation for display; ignore its math and use `calc.ts`.

## About the design files
These are **high-fidelity HTML/React-Babel design references** — recreate them in the existing stack: **Next.js 16 (App Router) + React 19 + TS, Tailwind v4 + shadcn/ui, @tanstack/react-query, recharts, lucide-react, sonner**. Map the hand-rolled SVG visuals onto recharts; map inline-styled cards onto Tailwind + shadcn `Card`; replace the inline `Icon` glyphs with `lucide-react`.

## Fidelity
**High-fidelity.** Colors, type, spacing, motion, and layout are final. Recreate faithfully with the codebase's tokens/components.

---

## Screens (what each really is)

### Dashboard (`/`) — 8-card bento
1. **Vault Progress** (hero, spans 2 cols) — ring (current %) with a faint projected arc, big current vault $, progress bar, "$X to $Y cap".
2. **CO Budget** (green) — current week range, big green "left to spend overall", "Spent $X · Maximum allowed $Y" (cumulative).
3. **Next Paycheck** — date, employer badge, Pending pill, projected net / vault / CO spend.
4. **Projected (end of summer)** — 2×2: Vault, CO, Buffer, Rent paid (projected totals).
5. **Paycheck Status** — "N pending of 14 total", segmented received/total bar, received/pending pills.
6. **Accounts** — live "right now" balances per real account (credit shown negative).
7. **Recent Expenses** — last 5 entries.
8. **Allocation Breakdown** — donut + legend (Vault/Rent/Robinhood/CO/Buffer % allocated so far).

### Paychecks (`/paychecks`) — "Paycheck Plan" editable table
Columns: **# · Pay Date · Employer (USC/NTT) · Received (checkbox) · Hours · OT · Per Diem · Actual Net · Gross Pay · Extra Deposit · Net % · Vault · Rent · RH · CO Spend · BofA** + row edit.
- Editable cells: Hours, OT, Per Diem, Actual Net, Extra Deposit (save on blur in production).
- Computed cells (read-only): Gross Pay, Net %, Vault, Rent, RH, CO Spend, BofA — from `calc.ts`.
- Footer summary cards: Total Vault (Current / Projected), Summer CO Budget (Projected / allocated so far), Total Buffer (Current / Projected), Vault Progress %.

### Expenses (`/expenses`)
- Add form: Description, Amount, Date, Category (select + chips), Account (select). Adds optimistically with a toast.
- Cumulative CO budget bar: "$X left to spend overall · Spent $Y · Maximum allowed $Z".
- Entries grouped by week ("Week of Jun 1 – Jun 7" + week total); each row: date, description, category tag, account tag, amount, delete.

### Accounts (`/accounts`) — arrival → now → projected journey
- Three net-worth cards: **At arrival**, **Right now**, **Leaving with (projected)** + "Net change over the summer".
- Per-account cards (Chase Checking, BofA Checking, Marcus HYSA = vault, Chase/BofA Credit Card): At arrival / Right now / Projected end, "+$X from now" delta, type tags, edit pencil. Vault account shows a goal progress bar; credit cards show outstanding balance (red) + "Pay credit card".

### Weekly (`/weekly`) — "Weekly Tracker"
- Green summary: "$X left to spend this summer · Spent $Y of $Z projected CO".
- **Spending vs Budget**: cumulative line/area chart — Spending Budget (cumulative CO allowance, → ~$2,400) vs Actual Spent (cumulative).
- **Weekly Breakdown** table: Week · Start · End · Spending Budget · Actual Spent · Variance · Vault Balance · Status (Past/Current/Future).

### Settings (`/settings`)
Goal (vault target + deadline), Employers (USC/NTT, paycheck count + net %), Allocation buckets pipeline. *(Production Settings wasn't captured — adapt to the real settings fields; treat this screen as a styling reference.)*

---

## Data shape (`window.SP` in `data.js`) → Supabase
Reproduce this shape from live data (e.g. a `useSummerData()` hook). Key derivations are all in `data.js` and mirror the app:
- `paychecks[]`: `{ date, employer, received, hours, ot, perDiem, actualNet, grossPay, extraDeposit, netPct, vault, rent, rh, co, bofa }` — from `paychecks` table (+ `calc.ts` for computed cols).
- `accounts[]`: `{ name, tags, kind, arrival, now, projected, goalTarget? }` — `kind ∈ checking|vault|credit`; net worth sums treat `credit` as negative.
- `accountsSummary`: `{ arrival, now, projected, change }`.
- `expenses[]`: `{ date, description, category, account, amount }`; grouped Mon–Sun.
- `weekly[]`: cumulative per week `{ startLabel, endLabel, budget (cum CO), spent (cum actual), variance, vaultBalance (cum vault+extra), status }`.
- `summary`: vault (`current/projected/cap/pct`), co (`spentSummer/projectedCO/leftSummer/weekRange/allowedNow/leftNow`), buffer, rentPaidProjected, paychecks (`received/pending/total`), nextPaycheck.

## Charts → recharts
Vault/goal rings → `RadialBarChart` (or keep the SVG `Ring`; the secondary arc = projected). Cumulative Weekly → `LineChart`/`AreaChart` (two cumulative series + gradient). Allocation donut → `PieChart` (innerRadius). Dashboard progress bars → simple divs. Paychecks/Weekly tables → shadcn `Table`.

## Interactions & motion
Count-ups on headline numbers, rings/bars/areas draw-in on scroll (staggered), card hover-lift, donut hover highlight, optimistic expense add + toast, segmented progress. All respect `prefers-reduced-motion` and a global motion-intensity tweak.

## Design tokens (CSS vars in `Summer Planner.html`)
- **Type**: Display `Bricolage Grotesque` (numbers/headings), UI `Instrument Sans`. Port to Tailwind theme.
- **Accent** default Coral `#ec6a4d` (options Magenta/Violet/Teal). **Gold** for the vault gradient, **green** `--pos` for CO/positive, **mint** for received.
- **Bucket / category colors**: `oklch(0.68 0.14 <hue>)` per fixed hue (in `data.js`). Keep the formula.
- Warm-neutral light theme + plum-navy dark theme; radius 20px (tweakable); soft 2-layer shadow.

## Files
`Summer Planner.html` (shell + tokens + load order), `app.jsx` (nav/routing/theme/tweaks), `data.js` (**read first** — exact data shape + derivations), `components.jsx` (Ring/Donut/AreaChart/BarChart/ProgressBar/Money/Icon/format), `screens-common.jsx`, `screens-dashboard.jsx`, `screens-paychecks.jsx`, `screens-expenses.jsx`, `screens-accounts-weekly-settings.jsx`, `tweaks-panel.jsx`.

### TL;DR
1. Recreate these screens in the existing Next.js + Tailwind + shadcn + recharts stack.
2. Feed them **live Supabase data** via a read-only hook over `settings`/`paychecks`/`expenses`.
3. Keep `calc.ts` as the math source of truth.
4. **Never modify the database.**
