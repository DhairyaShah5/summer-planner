# Summer Planner

Personal finance app for summer 2026: paycheck allocation, expense tracking, account ledgers, and net-worth projection. Started as a replacement for a sprawling Excel workbook; turned into a multi-screen Next.js app deployed to Vercel.

Live at **[summer-planner-wheat.vercel.app](https://summer-planner-wheat.vercel.app)**.

## What it does

- **Paychecks (14 rows)** — USC On-Campus + NTT (Colorado Internship) checks. Editable hours, OT, per diem, reimbursement, actual net, extra deposit. Computed columns (Gross Pay, Net %, Vault, Rent, RH, CO Spend, BofA) update live from `src/lib/calc.ts`.
- **Allocation model** — each paycheck cascades into Vault → Rent → Robinhood → CO Spend → BofA → Buffer per fixed multiples-of-$100 rules. Per diem and OT excess are non-taxable and route to BofA Checking (Plan B). Reimbursements stay in Chase Checking. Vault throttles to land exactly at the $20,000 tuition cap by Aug 28.
- **Expenses** — mobile-first add form with category chip strip (Eating Out, Groceries, Personal Care, Transport, Entertainment, Shopping, Bills & Utilities, Health, Subscriptions, Other). Reimbursable toggle per row hides the entry from the CO budget while still updating the account balance. Animated translucent fill on the "left to spend" card shows budget consumption in real time.
- **Accounts** — live current balance per account (Chase Checking, BofA Checking, Marcus HYSA, Chase / BofA credit cards). Three hero cards (At Arrival / Right Now / Leaving With) sum across selectable accounts (click any card to customize inclusion). Composition donut for assets right now.
- **Per-account ledger** — click any account card to open a chronological ledger derived from arrival + paycheck flows (split into inflow, vault transfer, rent payment, RH transfer × 2 weeks) + expenses + cc payments + transfers + manual entries. Add / edit / delete manual entries. Dates on derived rows are individually overridable via `paychecks.flow_overrides` JSONB.
- **Weekly Tracker** — cumulative spending vs budget area chart, week-by-week breakdown, **rollover sweep banner**: when unspent CO accumulates above the threshold (default $500), offers to sweep the excess (minus a cushion, default $250) to BofA via a confirmation modal. Records the move as a `kind='rollover_sweep'` transfer.
- **Settings** — vault target + deadline, employer net-% baselines, rent / Robinhood / vault defaults, **rollover sweep threshold + cushion** are all editable. Import-from-Excel button preserved for one-shot xlsx bootstrap.
- **Dashboard** — bento layout: vault progress hero (ring + ProgressBar), CO budget tile, vault growth area chart, CO budget gauge, next paycheck, projected end-of-summer breakdown, paycheck status segmented progress, live accounts preview (top 3), recent expenses, allocation breakdown donut (received-only).
- **Top nav** — live Vault Mini pill showing current % + $ on every screen.

## UI / UX

- Dark-mode default with a sun/moon toggle (next-themes, `enableSystem={false}`)
- Editorial typeface — **Bricolage Grotesque** for display + **Instrument Sans** for UI, both via `next/font/google`
- Locked design palette: Violet `#8a6fe0` accent + gold + emerald (`--pos`) + mint + rose
- Always-on **BackgroundFX**: 3 aurora gradient blobs + grain noise overlay + cursor-following 3D card tilt + thin scroll-progress bar
- Count-up animations on every dollar figure, IntersectionObserver-triggered reveals
- Every card respects `prefers-reduced-motion`
- Custom interactive **AllocationChart** on Paychecks: hover bars for tooltip with full bucket breakdown, next-pending paycheck accent-outlined, received bars full-color vs pending muted

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript
- **Tailwind v4** + **shadcn/ui** (base-ui, not Radix)
- **Supabase** Postgres + Auth (magic link + password) + Row Level Security
- **@tanstack/react-query** for client cache + mutations (server actions for most writes)
- **framer-motion** for entrance reveals + decorative motion
- **recharts** (light usage; most viz is hand-rolled SVG for full control)
- **next-themes**, **sonner**, **lucide-react**, **date-fns**
- Deployed on **Vercel** with auto-deploy from `main`

## Schema

All tables RLS-scoped by `auth.uid()`. See `supabase/migrations/` for the full history; the latest shape:

- `settings` — one row per user. Vault cap, USC gross baseline, NTT hourly rate, both net %, rent_monthly, rent_months, robinhood_weekly, USC no-rent / rent / NTT vault defaults, rollover sweep threshold + cushion.
- `paychecks` — 14 rows. pay_num, pay_date, employer, hours_worked, ot_hours, actual_net_wages, per_diem, reimbursement, extra_deposit, vault_override, gross_override, rent_paid, notes, received, flow_overrides JSONB (per-paycheck date overrides for ledger derivation).
- `expenses` — many rows. expense_date, description, amount, category, account_id, count_in_co_budget (Reimbursable flag).
- `accounts` — 5 rows (Chase Checking, BofA Checking, Marcus HYSA, Chase CC, BofA CC). arrival_balance, type, is_paycheck_destination, is_vault, display_order, include_in_net_worth.
- `cc_payments` — credit-card payment events (from_account → to_account, dated).
- `transfers` — general account-to-account transfers with kind enum (`manual` / `rollover_sweep` / `per_diem_to_bofa` / `ot_to_bofa`).
- `account_entries` — per-account ledger log for non-personal transactions (bills, upcoming charges) that affect balance but stay off the expense book. Signed amount.

## Architecture

- **`src/lib/calc.ts`** is the math source of truth — every computed column on every page reads from here. `computeRow` returns the full per-paycheck breakdown. `computeAccountStates` threads paychecks + expenses + cc_payments + transfers + account_entries through to produce live `(arrival, current, projected)` per account.
- Server actions in `src/app/<page>/*-actions.ts` handle all writes (expenses, cc payments, transfers, account entries, flow overrides, net-worth inclusion). Each revalidates the affected routes.
- Pages are server components for data loading; presentation pulled into `*-list.tsx` or `*-table.tsx` client components for interactivity.
- Shared redesign atoms in `src/components/redesign/` (PageHeader, SectionLabel, Reveal, Money, fmtMoney, Ring, Donut, AreaChart, BarChart, StackedBars, GaugeArc, Pill, CatDot, BackgroundFX, VaultMini).

## Local dev

```bash
cp .env.local.example .env.local   # fill in Supabase URL + keys
npm install
npm run dev
```

Open `http://localhost:3000` → log in via magic link or password → start logging.

Apply pending migrations with:

```bash
supabase link --project-ref <ref>
supabase db push
```

## Why the Excel needed replacing

The xlsx worked, but it broke down for daily use: no mobile entry, no auth on the file itself, formulas brittle when adding columns, no way to audit the CO budget at a glance from a phone, no concept of pass-through transactions or reimbursable expenses. This app keeps the same allocation math but adds real-time account ledgers, automated rollover sweep nudges, multi-device sync, per-account inclusion toggles, and dark mode with a proper design system.

## Design

The `design/` folder contains the v2 UI redesign handoff (React + Babel reference files that drove the makeover). Not part of the build — kept for posterity and future iteration.
