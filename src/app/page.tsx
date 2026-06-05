import { redirect } from "next/navigation";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  Vault,
  Calendar,
  Wallet,
  TrendingUp,
  Receipt,
  ClipboardList,
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
  }));

  const computed = computeAll(inputs, settings);
  const totals = summarize(computed, settings);

  const { data: expenseRows } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false });

  const expenses: Expense[] = (expenseRows ?? []).map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    description: e.description,
    amount: e.amount,
    category: e.category ?? "",
    created_at: e.created_at,
  }));

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekStartISO = format(weekStart, "yyyy-MM-dd");
  const weekEndISO = format(weekEnd, "yyyy-MM-dd");

  const targetCOThisWeek = computed
    .filter((r) => String(r.payDate) <= weekEndISO)
    .reduce((s, r) => s + r.co, 0);

  const actualThisWeek = expenses
    .filter(
      (e) => e.expense_date >= weekStartISO && e.expense_date <= weekEndISO,
    )
    .reduce((s, e) => s + e.amount, 0);

  const variance = targetCOThisWeek - actualThisWeek;
  const isUnder = variance >= 0;

  const nextPaycheck =
    computed.find((r) => r.status === "Pending") ?? computed[0] ?? null;

  const totalRentPaid = computed.reduce((s, r) => s + r.rentPaid, 0);

  const vaultPct =
    settings.vaultCap > 0
      ? Math.min(100, (totals.totalVault / settings.vaultCap) * 100)
      : 0;
  const vaultRemaining = settings.vaultCap - totals.totalVault;

  const recentExpenses = expenses.slice(0, 5);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Summer 2026 paycheck allocation overview
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vault className="size-4 text-primary" />
              Vault Progress
            </CardTitle>
            <CardDescription>
              {money.format(totals.totalVault)} of{" "}
              {moneyWhole.format(settings.vaultCap)} toward tuition + fees
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-4xl font-semibold tracking-tight tabular-nums">
              {money.format(totals.totalVault)}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${vaultPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{vaultPct.toFixed(1)}% funded</span>
              <span>{money.format(vaultRemaining)} remaining</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              This Week CO Budget
            </CardTitle>
            <CardDescription>
              {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Target</span>
              <span className="font-medium tabular-nums">
                {money.format(targetCOThisWeek)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Actual</span>
              <span className="font-medium tabular-nums">
                {money.format(actualThisWeek)}
              </span>
            </div>
            <div className="border-t pt-2 flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Variance</span>
              <span
                className={`text-lg font-semibold tabular-nums ${
                  isUnder ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {isUnder ? "+" : "-"}
                {money.format(Math.abs(variance))}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isUnder ? "Under budget" : "Over budget"}
            </p>
          </CardContent>
        </Card>

        <Card>
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
                  <span className="text-sm font-medium">
                    {nextPaycheck.employer}
                  </span>
                  <Badge
                    variant={
                      nextPaycheck.status === "Pending"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {nextPaycheck.status}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Projected net</span>
                    <span className="font-medium tabular-nums">
                      {money.format(
                        nextPaycheck.actualNetWages ?? nextPaycheck.estimatedNet,
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Summer Totals
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

        <Card>
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
              <Badge variant="secondary">{totals.rowsReceived} received</Badge>
              <Badge variant="outline">{totals.rowsPending} pending</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4 text-primary" />
              Recent Expenses
            </CardTitle>
            <CardDescription>
              {recentExpenses.length > 0
                ? `Last ${recentExpenses.length} entries`
                : "No expenses yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentExpenses.length > 0 ? (
              <ul className="divide-y">
                {recentExpenses.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {e.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">
                Log expenses on the Expenses page to see them here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
