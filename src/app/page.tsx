import { redirect } from "next/navigation";
import { format, startOfWeek, endOfWeek } from "date-fns";
import type { VaultGrowthPoint } from "./dashboard-tiles";

import { createClient } from "@/lib/supabase/server";
import {
  computeAll,
  computeAccountStates,
  summarize,
  type Settings,
  type PaycheckInput,
  type Employer,
  type AccountInput,
  type ExpenseInput,
  type CCPaymentInput,
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
    nttVaultDefault: settingsRow.ntt_vault_default,
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
    grossOverride: p.gross_override,
    rentPaid: p.rent_paid,
    received: p.received,
  }));

  const computed = computeAll(inputs, settings);
  const totals = summarize(computed, settings);

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekEndISO = format(weekEnd, "yyyy-MM-dd");
  const todayISO = format(now, "yyyy-MM-dd");

  // Parallel queries: recent expenses for the list, cumulative expenses
  // through today for the CO Budget tile, all accounts (full set is needed
  // so per-account paycheck / expense / cc-payment flows can be applied
  // before the top 3 are sliced), all expenses keyed by account, and all
  // cc_payments. The CO tile uses cumulative framing so unspent CO from
  // earlier weeks rolls forward.
  const [
    recentExpensesRes,
    cumExpensesRes,
    accountsRes,
    allExpensesRes,
    ccPaymentsRes,
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(5),
    supabase
      .from("expenses")
      .select("amount")
      .lte("expense_date", todayISO),
    supabase
      .from("accounts")
      .select(
        "id, name, type, arrival_balance, display_order, is_paycheck_destination, is_vault",
      )
      .order("display_order", { ascending: true }),
    supabase
      .from("expenses")
      .select("id, expense_date, amount, account_id"),
    supabase
      .from("cc_payments")
      .select("id, paid_at, from_account_id, to_account_id, amount"),
  ]);

  const recentExpenses: Expense[] = (recentExpensesRes.data ?? []).map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    description: e.description,
    amount: e.amount,
    category: e.category ?? "",
    account_id: e.account_id ?? null,
    created_at: e.created_at,
  }));

  // Derive live account balances (current = received-paycheck activity +
  // dated expenses + cc payments through today). Then take the top 3 by
  // display_order for the dashboard preview.
  const accountInputs: AccountInput[] = (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as 'checking' | 'credit_card' | 'hysa',
    arrival_balance: Number(a.arrival_balance),
    is_paycheck_destination: a.is_paycheck_destination,
    is_vault: a.is_vault,
    display_order: a.display_order,
  }));

  const expenseInputs: ExpenseInput[] = (allExpensesRes.data ?? []).map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    amount: Number(e.amount),
    account_id: e.account_id ?? null,
  }));

  const ccPaymentInputs: CCPaymentInput[] = (ccPaymentsRes.data ?? []).map(
    (p) => ({
      id: p.id,
      paid_at: p.paid_at,
      from_account_id: p.from_account_id,
      to_account_id: p.to_account_id,
      amount: Number(p.amount),
    }),
  );

  const accountStates = computeAccountStates(
    accountInputs,
    inputs,
    expenseInputs,
    settings,
    ccPaymentInputs,
  );

  const accountsPreview = accountStates.slice(0, 3).map((s) => ({
    id: s.account.id,
    name: s.account.name,
    type: s.account.type,
    current_balance: s.current,
  }));

  // Cumulative spend across the summer through today.
  const cumSpent = (cumExpensesRes.data ?? []).reduce(
    (s, e) => s + (e.amount ?? 0),
    0,
  );

  // Cumulative CO maximum allowed = sum of CO from every paycheck whose
  // pay_date <= this Sunday (end of current week). Unspent CO from prior
  // weeks rolls forward into the current "left to spend" headline.
  const cumMaxAllowed = computed
    .filter((r) => String(r.payDate) <= weekEndISO)
    .reduce((s, r) => s + r.co, 0);

  const variance = cumMaxAllowed - cumSpent;
  const isUnder = variance >= 0;

  // Next paycheck = first row that hasn't been marked received yet.
  const nextPaycheckRow =
    computed.find((r) => !r.received) ?? computed[0] ?? null;

  const totalRentPaid = computed.reduce((s, r) => s + r.rentPaid, 0);
  const totalRobinhood = computed.reduce((s, r) => s + r.robinhood, 0);

  // Live (received-only) allocation totals for the Allocation Breakdown tile.
  // We want the donut to reflect money actually allocated so far, not the
  // full-summer projection.
  const currentRentPaid = computed
    .filter((r) => r.received)
    .reduce((s, r) => s + r.rentPaid, 0);
  const currentRobinhood = computed
    .filter((r) => r.received)
    .reduce((s, r) => s + r.robinhood, 0);

  const vaultPct =
    settings.vaultCap > 0
      ? Math.min(100, (totals.currentVault / settings.vaultCap) * 100)
      : 0;
  const vaultRemaining = Math.max(0, settings.vaultCap - totals.currentVault);

  // Weekly vault growth series for the AreaChart: one cumulative point per
  // paycheck, already capped via computeRow's cumulativeVault. We show every
  // other label to avoid axis crowding.
  const vaultGrowthSeries: VaultGrowthPoint[] = computed.map((r, i) => ({
    label:
      i % 2 === 0 ? format(new Date(String(r.payDate)), "MMM d") : "",
    value: r.cumulativeVault,
  }));

  const allocation: AllocationDatum[] = [
    { name: "Vault", value: totals.currentVault },
    { name: "Rent", value: currentRentPaid },
    { name: "Robinhood", value: currentRobinhood },
    { name: "CO", value: totals.currentCO },
    { name: "Buffer", value: totals.currentBuffer },
  ].filter((d) => d.value > 0) as AllocationDatum[];

  const todayLabel = format(now, "EEE, MMM d");

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <DashboardTiles
        todayLabel={todayLabel}
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
          actual: cumSpent,
          target: cumMaxAllowed,
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
        accountsPreview={accountsPreview}
        vaultGrowth={vaultGrowthSeries}
        coGauge={{ spent: cumSpent, allowed: cumMaxAllowed }}
        vaultCap={settings.vaultCap}
        deadlineLabel={format(new Date("2026-08-28T12:00:00"), "MMM d")}
      />
    </div>
  );
}
