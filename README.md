# Summer Planner

Personal paycheck allocation + expense tracker for summer 2026. Replaces a sprawling Excel workbook with a Next.js app I can use from anywhere.

## What it does

- Tracks 14 summer paychecks (USC on-campus + NTT internship) against a $22,858 tuition vault target
- Auto-cascades each paycheck's net into Vault / Rent / Robinhood / CO Spending / Buffer per fixed rules (mirrors the original xlsx formulas in `src/lib/calc.ts`)
- Routes per diem to CO spending, hourly wages to vault
- Logs expenses on the go (mobile-first add form), groups by week, compares actual vs. target CO budget
- Surfaces vault progress, current-week budget status, and projected end-of-summer totals on a single dashboard

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 + shadcn/ui
- Supabase (Postgres + Auth via magic link + Row Level Security)
- @tanstack/react-query for client cache + mutations
- date-fns, recharts, lucide-react, sonner
- Deployed on Vercel

## Local dev

```bash
cp .env.local.example .env.local   # fill in Supabase URL + keys
npm install
npm run dev
```

Open http://localhost:3000 → log in via magic link to your email → start logging.

## Schema

Three tables, all RLS-scoped by `auth.uid()`:

- `settings` — one row per user (vault cap, pay rates, rent, allocation rules)
- `paychecks` — 14 rows per summer (pay date, employer, hours, per diem, actual net, computed allocations)
- `expenses` — many rows (date, description, amount, category)

Migrations live in `supabase/migrations/`. Apply with `supabase db push` after `supabase link`.

## Why the Excel needed replacing

The xlsx worked, but it broke down for daily use: no mobile entry, no auth on the file itself, formulas were brittle when adding columns, and I couldn't audit my CO budget at a glance from my phone. This app keeps the same allocation math (ported from the xlsx) while making everything else nicer.
