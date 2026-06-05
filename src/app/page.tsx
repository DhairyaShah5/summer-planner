import { redirect } from "next/navigation";
import { format, startOfWeek, endOfWeek } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import {
  computeAll,
  summarize,
  type Settings,
  type PaycheckInput,
  type Employer,
} from "@/lib/calc";
import type { Expense } from "@/lib/types";
import type { AllocationDatum } from "@/components/allocation-breakdown";
import { DashboardTiles } from "./dashboard-tiles";

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
      throw new Error(
        `Failed to create settings: ${insertError.message} (code=${insertError.code})`,
      );
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
  const nextPaycheckRow =
    computed.find((r) => !r.received) ?? computed[0] ?? null;

  const totalRentPaid = computed.reduce((s, r) => s + r.rentPaid, 0);
  const totalRobinhood = computed.reduce((s, r) => s + r.robinhood, 0);

  const vaultPct =
    settings.vaultCap > 0
      ? Math.min(100, (totals.currentVault / settings.vaultCap) * 100)
      : 0;
  const vaultRemaining = Math.max(0, settings.vaultCap - totals.currentVault);

  const allocation: AllocationDatum[] = [
    { name: "Vault", value: totals.totalVault },
    { name: "Rent", value: totalRentPaid },
    { name: "Robinhood", value: totalRobinhood },
    { name: "CO", value: totals.totalCO },
    { name: "Buffer", value: totals.totalBuffer },
  ].filter((d) => d.value > 0) as AllocationDatum[];

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <h1 className="bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Summer 2026 paycheck allocation overview
        </p>
      </div>

      <DashboardTiles
        vault={{
          current: totals.currentVault,
          projected: totals.totalVault,
          cap: settings.vaultCap,
          percent: vaultPct,
          remaining: vaultRemaining,
        }}
        weekBudget={{
          weekStartLabel: format(weekStart, "MMM d"),
          weekEndLabel: format(weekEnd, "MMM d"),
          variance,
          isUnder,
          actual: actualThisWeek,
          target: targetCOThisWeek,
        }}
        nextPaycheck={
          nextPaycheckRow
            ? {
                payDateLabel: format(
                  new Date(String(nextPaycheckRow.payDate)),
                  "EEE, MMM d",
                ),
                employer: nextPaycheckRow.employer,
                status: nextPaycheckRow.status,
                projectedNet:
                  nextPaycheckRow.received &&
                  nextPaycheckRow.actualNetWages != null
                    ? nextPaycheckRow.actualNetWages
                    : nextPaycheckRow.estimatedNet,
                vault: nextPaycheckRow.vault,
                co: nextPaycheckRow.co,
              }
            : null
        }
        projected={{
          totalVault: totals.totalVault,
          totalCO: totals.totalCO,
          totalBuffer: totals.totalBuffer,
          totalRentPaid,
        }}
        paycheckStatus={{
          pending: totals.rowsPending,
          received: totals.rowsReceived,
          total: computed.length,
        }}
        recentExpenses={recentExpenses}
        allocation={allocation}
      />
    </div>
  );
}
