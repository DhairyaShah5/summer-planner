import { redirect } from "next/navigation";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  Vault,
  Calendar,
  Wallet,
  TrendingUp,
  Receipt,
  ClipboardList,
  Inbox,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  computeAll,
  summarize,
  type Settings,
  type PaycheckInput,
  type Employer,
} from "@/lib/calc";
import type { Expense } from "@/lib/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let { data: settingsRow } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!settingsRow) {
    const { data: inserted, error: insertError } = await supabase
      .from("settings")
      .insert({ user_id: user.id })
      .select("*")
      .single();
    if (insertError) {
      throw new Error(`Failed to create settings: ${insertError.message} (code=${insertError.code})`);
    }
    settingsRow = inserted;
  }

  if (!settingsRow) {
    throw new Error("Failed to load or create settings (no row returned)");
  }

  const settings: Settings = {
    vaultCap: settingsRow.vault_cap,
    uscGrossBaseline: settingsRow.usc_gross_baseline,
    nttHourlyRate: settingsRow.ntt_hourly_rate,
    uscNetPct: settingsRow.usc_net_pct,
    nttNetPct: settingsRow.ntt_net_pct,
    rentMonthly: settingsRow.rent_monthly,
    rentMonths: settingsRow.rent_months,
    robinhoodWeekly: settingsRow.robinhood_weekly,
    uscNoRentVault: settingsRow.usc_no_rent_vault,
    uscRentVault: settingsRow.usc_rent_vault,
  };

  const { data: paycheckRows } = await supabase
    .from("paychecks")
    .select("*")
    .order("pay_num", { ascending: true });

  const inputs: PaycheckInput[] = (paycheckRows ?? []).map((p) => ({
    payNum: p.pay_num,
    payDate: p.pay_date,
    employer: p.employer as Employer,
    hoursWorked: p.hours_worked,
    otHours: p.ot_hours,
    actualNetWages: p.actual_net_wages,
    perDiem: p.per_diem,
    extraDeposit: p.extra_deposit,
    vaultOverride: p.vault_override,
    rentPaid: p.rent_paid,
    received: p.received,
  }));

  const computed = computeAll(inputs, settings);
  const totals = summarize(computed, settings);

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekStartISO = format(weekStart, "yyyy-MM-dd");
  const weekEndISO = format(weekEnd, "yyyy-MM-dd");

  // Two parallel queries: recent expenses for the list, and this-week expenses
  // for the budget tile. Splitting avoids fetching the whole table.
  const [recentExpensesRes, weekExpensesRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(5),
    supabase
      .from("expenses")
      .select("amount")
      .gte("expense_date", weekStartISO)
      .lte("expense_date", weekEndISO),
  ]);

  const recentExpenses: Expense[] = (recentExpensesRes.data ?? []).map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    description: e.description,
    amount: e.amount,
    category: e.category ?? "",
    created_at: e.created_at,
  }));

  const actualThisWeek = (weekExpensesRes.data ?? []).reduce(
    (s, e) => s + (e.amount ?? 0),
    0,
  );

  // Target CO for this week = sum of CO from paychecks whose payDate falls
  // within [weekStart, weekEnd]. Matches the tile label semantics — paychecks
  // landing this week fund this week's CO spending.
  const targetCOThisWeek = computed
    .filter(
      (r) =>
        String(r.payDate) >= weekStartISO &&
        String(r.payDate) <= weekEndISO,
    )
    .reduce((s, r) => s + r.co, 0);

  const variance = targetCOThisWeek - actualThisWeek;
  const isUnder = variance >= 0;

  // Next paycheck = first row that hasn't been marked received yet.
  const nextPaycheck =
    computed.find((r) => !r.received) ?? computed[0] ?? null;

  const totalRentPaid = computed.reduce((s, r) => s + r.rentPaid, 0);

  const vaultPct =
    settings.vaultCap > 0
      ? Math.min(100, (totals.currentVault / settings.vaultCap) * 100)
      : 0;
  const vaultRemaining = Math.max(0, settings.vaultCap - totals.currentVault);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Summer 2026 paycheck allocation overview
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-gradient-to-br from-primary/10 to-transparent transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vault className="size-4 text-primary" />
              Vault Progress
            </CardTitle>
            <CardDescription className="tabular-nums">
              {money.format(totals.currentVault)} today &middot; projected{" "}
              {moneyWhole.format(totals.totalVault)} by Aug 28
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl font-semibold tracking-tight tabular-nums transition-transform group-hover/card:scale-[1.01]">
              {money.format(totals.currentVault)}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              Saving toward {moneyWhole.format(settings.vaultCap)} (
              {vaultPct.toFixed(1)}% of the way)
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${vaultPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{vaultPct.toFixed(1)}% funded</span>
              <span>
                {money.format(vaultRemaining)} to{" "}
                {moneyWhole.format(settings.vaultCap)} cap
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              This Week CO Budget
            </CardTitle>
            <CardDescription>
              {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div
              className={`text-3xl font-semibold tracking-tight tabular-nums ${
                isUnder ? "" : "text-destructive"
              }`}
            >
              {money.format(Math.abs(variance))}
            </div>
            <p className="text-sm text-muted-foreground">
              {isUnder ? "left to spend this week" : "over budget"}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              Spent {money.format(actualThisWeek)} of{" "}
              {money.format(targetCOThisWeek)} target
            </p>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              Next Paycheck
            </CardTitle>
            <CardDescription>
              {nextPaycheck
                ? format(new Date(String(nextPaycheck.payDate)), "EEE, MMM d")
                : "No paychecks scheduled"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextPaycheck ? (
              <>
                <div className="flex items-center justify-between">
                  <EmployerBadge employer={nextPaycheck.employer} />
                  <StatusBadge status={nextPaycheck.status} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Projected net</span>
                    <span className="font-medium tabular-nums">
                      {money.format(
                        nextPaycheck.received && nextPaycheck.actualNetWages != null
                          ? nextPaycheck.actualNetWages
                          : nextPaycheck.estimatedNet,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vault</span>
                    <span className="font-medium tabular-nums">
                      {money.format(nextPaycheck.vault)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CO spend</span>
                    <span className="font-medium tabular-nums">
                      {money.format(nextPaycheck.co)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add a paycheck on the Paychecks page.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Projected (end of summer)
            </CardTitle>
            <CardDescription>Projected allocations across summer</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">Vault</dt>
                <dd className="text-base font-semibold tabular-nums">
                  {money.format(totals.totalVault)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">CO</dt>
                <dd className="text-base font-semibold tabular-nums">
                  {money.format(totals.totalCO)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Buffer</dt>
                <dd className="text-base font-semibold tabular-nums">
                  {money.format(totals.totalBuffer)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Rent paid</dt>
                <dd className="text-base font-semibold tabular-nums">
                  {money.format(totalRentPaid)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4 text-primary" />
              Paycheck Status
            </CardTitle>
            <CardDescription>
              {totals.rowsPending} pending of {computed.length} total
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">
                {totals.rowsPending}
              </span>
              <span className="text-sm text-muted-foreground">pending</span>
            </div>
            <div className="flex gap-2">
              <StatusBadge status="Received" count={totals.rowsReceived} />
              <StatusBadge status="Pending" count={totals.rowsPending} />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-1 transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4 text-primary" />
              Recent Expenses
            </CardTitle>
            <CardDescription>
              {recentExpenses.length > 0
                ? `Last ${recentExpenses.length} entries`
                : "Nothing logged yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentExpenses.length > 0 ? (
              <ul className="divide-y">
                {recentExpenses.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between py-2 first:pt-0 last:pb-0 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {e.description}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(e.expense_date), "MMM d")}
                      </p>
                    </div>
                    <span className="ml-3 text-sm font-medium tabular-nums">
                      {money.format(e.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <div className="rounded-full bg-muted p-3">
                  <Inbox className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No expenses yet</p>
                <p className="text-xs text-muted-foreground">
                  Log spend on the Expenses page to see it here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmployerBadge({ employer }: { employer: string }) {
  const isUSC = employer === "USC On-Campus";
  return (
    <Badge
      className={
        isUSC
          ? "bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300 font-normal"
          : "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 font-normal"
      }
    >
      {isUSC ? "USC" : "NTT"}
    </Badge>
  );
}

function StatusBadge({
  status,
  count,
}: {
  status: "Received" | "Pending";
  count?: number;
}) {
  const label = count == null ? status : `${count} ${status.toLowerCase()}`;
  if (status === "Received") {
    return <Badge variant="default">{label}</Badge>;
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 font-normal">
      {label}
    </Badge>
  );
}
