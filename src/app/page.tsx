import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import type { VaultGrowthPoint } from "./dashboard-tiles";
import { todayInUserTz } from "@/lib/today";

import { getViewerContext } from "@/lib/viewer-context";
import {
  computeAll,
  computeAccountStates,
  summarize,
  type Settings,
  type PaycheckInput,
  type Employer,
  type AccountInput,
  type AccountEntryInput,
  type ExpenseInput,
  type CCPaymentInput,
  type TransferInput,
} from "@/lib/calc";
import type { Expense } from "@/lib/types";
import type { AllocationDatum } from "@/components/allocation-breakdown";
import { DashboardTiles } from "./dashboard-tiles";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, userId, viewMode } = await getViewerContext();

  let { data: settingsRow } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!settingsRow && !viewMode) {
    const { data: inserted, error: insertError } = await supabase
      .from("settings")
      .insert({ user_id: userId })
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

  const inputs: PaycheckInput[] = (paycheckRows ?? []).map((p) => {
    const overrides = (p.flow_overrides as Record<string, string> | null) ?? {};
    return {
      payNum: p.pay_num,
      payDate: p.pay_date,
      employer: p.employer as Employer,
      hoursWorked: p.hours_worked,
      otHours: p.ot_hours,
      actualNetWages: p.actual_net_wages,
      perDiem: p.per_diem,
      extraDeposit: p.extra_deposit,
      reimbursement: p.reimbursement ?? 0,
      vaultOverride: p.vault_override,
      grossOverride: p.gross_override,
      rentPaid: p.rent_paid,
      rentDateOverride: overrides.rent ?? null,
      coOverride: overrides.co_amount != null ? Number(overrides.co_amount) : null,
      bofaOverride:
        overrides.bofa_overflow != null ? Number(overrides.bofa_overflow) : null,
      received: p.received,
    };
  });

  const computed = computeAll(inputs, settings);
  const totals = summarize(computed, settings);

  // User-timezone today/week boundaries so the server's UTC clock
  // doesn't shift the week one day early around local midnight.
  const todayISO = todayInUserTz();
  const now = parseISO(todayISO);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekEndISO = format(weekEnd, "yyyy-MM-dd");

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
    transfersRes,
    accountEntriesRes,
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(5),
    supabase
      .from("expenses")
      .select("amount, count_in_co_budget")
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
      .select("id, paid_at, from_account_id, to_account_id, amount, kind"),
    supabase
      .from("transfers")
      .select(
        "id, transferred_at, from_account_id, to_account_id, amount, kind",
      ),
    supabase
      .from("account_entries")
      .select("id, account_id, dated_at, amount, description"),
  ]);

  const recentExpenses: Expense[] = (recentExpensesRes.data ?? []).map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    description: e.description,
    amount: Number(e.amount),
    category: e.category ?? "",
    account_id: e.account_id ?? null,
    count_in_co_budget: e.count_in_co_budget,
    is_personal: e.is_personal ?? false,
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
      kind: p.kind ?? 'payment',
    }),
  );

  const transferInputs: TransferInput[] = (transfersRes.data ?? []).map((t) => ({
    id: t.id,
    transferred_at: t.transferred_at,
    from_account_id: t.from_account_id,
    to_account_id: t.to_account_id,
    amount: Number(t.amount),
    kind: t.kind as TransferInput['kind'],
  }));

  const accountEntryInputs: AccountEntryInput[] = (
    accountEntriesRes.data ?? []
  ).map((e) => ({
    id: e.id,
    account_id: e.account_id,
    dated_at: e.dated_at,
    amount: Number(e.amount),
    description: e.description,
  }));

  const accountStates = computeAccountStates(
    accountInputs,
    inputs,
    expenseInputs,
    settings,
    ccPaymentInputs,
    transferInputs,
    accountEntryInputs,
    todayISO,
  );

  const accountsPreview = accountStates.slice(0, 3).map((s) => ({
    id: s.account.id,
    name: s.account.name,
    type: s.account.type,
    current_balance: s.current,
  }));

  // Cumulative spend across the summer through today. Off-budget expenses
  // (count_in_co_budget === false) are excluded from the CO budget tile.
  const cumSpent = (cumExpensesRes.data ?? [])
    .filter((e) => e.count_in_co_budget !== false)
    .reduce((s, e) => s + (e.amount ?? 0), 0);

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

  // BofA wages tracker: each received paycheck routes floor100(OT excess)
  // into BofA via the model's bofaOverflow field. Per diem is intentionally
  // *excluded* from the topup math per user request, even though the model
  // bundles it into bofaOverflow alongside the OT excess. Subtracting perDiem
  // isolates the wage-only portion that should drive vault top-ups.
  const wagesInBofa = computed
    .filter((r) => r.received)
    .reduce((s, r) => s + Math.max(0, r.bofaOverflow - r.perDiem), 0);
  // Look up the vault + source-account ids once so the sweep/buffer math
  // below can be kind-agnostic. `is_vault` marks Marcus; the paycheck
  // destination is Chase; BofA falls back to a name match (same trick
  // computeAccountStates uses).
  const vaultAccount = accountInputs.find((a) => a.is_vault);
  const chaseCheckingAccount = accountInputs.find(
    (a) => a.is_paycheck_destination,
  );
  const bofaCheckingAccount = accountInputs.find(
    (a) =>
      a.type === "checking" &&
      (a.name.toLowerCase().includes("bofa") ||
        a.name.toLowerCase().includes("bank of america")),
  );
  const vaultAccountId = vaultAccount?.id;
  const chaseAccountId = chaseCheckingAccount?.id;
  const bofaAccountId = bofaCheckingAccount?.id;

  // Any BofA → Vault transfer drains the "wages waiting in BofA" pool the
  // top-up banner tracks, regardless of whether it was tagged as a
  // vault_topup_sweep or logged as a plain manual transfer.
  const bofaToVault = vaultAccountId && bofaAccountId
    ? transferInputs
        .filter(
          (t) =>
            t.from_account_id === bofaAccountId &&
            t.to_account_id === vaultAccountId,
        )
        .reduce((s, t) => s + t.amount, 0)
    : 0;
  const vaultTopupReady = Math.max(0, wagesInBofa - bofaToVault);
  // Any Chase → Vault transfer drains the buffer (residual sub-$100 wage
  // remainder that sits in Chase). Kind-agnostic so a manual Chase →
  // Marcus transfer behaves identically to a buffer_sweep.
  const bufferSweptSoFar = vaultAccountId && chaseAccountId
    ? transferInputs
        .filter(
          (t) =>
            t.from_account_id === chaseAccountId &&
            t.to_account_id === vaultAccountId,
        )
        .reduce((s, t) => s + t.amount, 0)
    : 0;
  // externalVaultSweeps = every non-scheduled dollar landing on Vault,
  // minus any dollars leaving. Includes vault_topup_sweep, buffer_sweep,
  // AND manual transfers to Marcus — anything the paycheck-vault schedule
  // doesn't already account for. Scheduled per-paycheck vault flows never
  // touch the `transfers` table so they can't double-count.
  let externalVaultSweeps = 0;
  if (vaultAccountId) {
    for (const t of transferInputs) {
      if (t.to_account_id === vaultAccountId) externalVaultSweeps += t.amount;
      if (t.from_account_id === vaultAccountId) externalVaultSweeps -= t.amount;
    }
  }

  // Project future BofA→Vault sweeps into the cumulativeVault series.
  // calc's cumulativeVault only counts scheduled per-paycheck vault transfers
  // (vault + extraDeposit); vault_topup_sweep moves money outside that flow,
  // so it's invisible to the base projection. We layer it in here:
  //   - past sweeps (vaultTopupSwept) lift every row as a baseline shift
  //   - for each future row we accumulate that row's projected wages-only
  //     BofA inflow into a running buffer; when the buffer crosses $1,000 we
  //     simulate a sweep (mirroring the manual banner behavior).
  let projectedFutureSweeps = 0;
  let projectedBofaWagesUnswept = vaultTopupReady;
  const projectedVaultPerRow: number[] = [];
  for (const r of computed) {
    if (!r.received) {
      projectedBofaWagesUnswept += Math.max(0, r.bofaOverflow - r.perDiem);
      const baseAtRow =
        r.cumulativeVault + externalVaultSweeps + projectedFutureSweeps;
      const roomLeft = Math.max(0, settings.vaultCap - baseAtRow);
      const roomFloored = Math.floor(roomLeft / 100) * 100;
      const sweepAmount =
        Math.floor(
          Math.min(projectedBofaWagesUnswept, roomFloored) / 500,
        ) * 500;
      if (sweepAmount > 0) {
        projectedFutureSweeps += sweepAmount;
        projectedBofaWagesUnswept -= sweepAmount;
      }
    }
    projectedVaultPerRow.push(
      Math.min(
        settings.vaultCap,
        r.cumulativeVault + externalVaultSweeps + projectedFutureSweeps,
      ),
    );
  }

  const currentVaultWithSweeps = Math.min(
    settings.vaultCap,
    totals.currentVault + externalVaultSweeps,
  );
  const projectedTotalVaultWithSweeps =
    projectedVaultPerRow[projectedVaultPerRow.length - 1] ?? totals.totalVault;

  const vaultPct =
    settings.vaultCap > 0
      ? Math.min(100, (currentVaultWithSweeps / settings.vaultCap) * 100)
      : 0;
  const vaultRemaining = Math.max(
    0,
    settings.vaultCap - currentVaultWithSweeps,
  );

  // Weekly vault growth series for the AreaChart: one cumulative point per
  // paycheck. Uses projectedVaultPerRow so the curve reflects both past
  // sweeps already done and future sweeps we expect from accumulated BofA
  // wages. Show every other label to avoid axis crowding.
  const vaultGrowthSeries: VaultGrowthPoint[] = computed.map((r, i) => ({
    label:
      i % 2 === 0 ? format(new Date(String(r.payDate)), "MMM d") : "",
    value: projectedVaultPerRow[i] ?? r.cumulativeVault,
    received: r.received,
  }));

  const allocation: AllocationDatum[] = [
    { name: "Vault", value: currentVaultWithSweeps },
    { name: "Rent", value: currentRentPaid },
    { name: "Robinhood", value: currentRobinhood },
    { name: "CO", value: totals.currentCO },
    { name: "Buffer", value: totals.currentBuffer - bufferSweptSoFar },
  ].filter((d) => d.value > 0) as AllocationDatum[];

  const todayLabel = format(now, "EEE, MMM d");

  // Sweep in $500 chunks but never overshoot the cap. Cap-room is floored
  // to $100 so a half-step doesn't sneak in. Uses currentVaultWithSweeps so
  // past sweeps count against remaining room.
  const vaultRoom = Math.max(0, settings.vaultCap - currentVaultWithSweeps);
  const vaultRoomFloored = Math.floor(vaultRoom / 100) * 100;
  const suggestedTopup = Math.min(
    Math.floor(vaultTopupReady / 500) * 500,
    vaultRoomFloored,
  );
  const showTopupBanner = vaultTopupReady >= 500 && suggestedTopup > 0;

  // Buffer sweep (Chase → Marcus): mirrors the vault-topup banner but on the
  // Chase side. The received-row buffer sum is the sub-$100 wage remainder
  // that quietly accumulates in Chase after every allocation clears; when it
  // grows past the threshold we offer to sweep the excess to Marcus, keeping
  // a cushion in Chase so a negative-buffer row (transfers > inflow) can't
  // silently drain the buffer.
  const currentBufferReceived = computed
    .filter((r) => r.received)
    .reduce((s, r) => s + r.buffer, 0);
  const bufferSurplus = currentBufferReceived - bufferSweptSoFar;
  const bufferThreshold = Number(settingsRow?.buffer_sweep_threshold ?? 500);
  const bufferCushion = Number(settingsRow?.buffer_sweep_cushion ?? 200);
  const suggestedBufferSweep = Math.max(
    0,
    Math.floor((bufferSurplus - bufferCushion) / 100) * 100,
  );
  const showBufferBanner =
    bufferSurplus >= bufferThreshold &&
    suggestedBufferSweep > 0 &&
    !!chaseCheckingAccount &&
    !!vaultAccount;

  // Per diem progress: cumulative received vs full-summer total. Visibility
  // only - never drives an auto-action.
  const perDiemExpected = computed.reduce((s, r) => s + r.perDiem, 0);
  const perDiemReceived = computed
    .filter((r) => r.received)
    .reduce((s, r) => s + r.perDiem, 0);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <DashboardTiles
        todayLabel={todayLabel}
        vault={{
          current: currentVaultWithSweeps,
          projected: projectedTotalVaultWithSweeps,
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
          totalVault: projectedTotalVaultWithSweeps,
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
        vaultTopup={{
          show: showTopupBanner,
          ready: vaultTopupReady,
          suggested: suggestedTopup,
          fromAccountId: bofaCheckingAccount?.id ?? "",
          toAccountId: vaultAccount?.id ?? "",
        }}
        bufferSweep={{
          show: showBufferBanner,
          surplus: bufferSurplus,
          suggested: suggestedBufferSweep,
          cushion: bufferCushion,
          fromAccountId: chaseCheckingAccount?.id ?? "",
          toAccountId: vaultAccount?.id ?? "",
        }}
        perDiem={{
          received: perDiemReceived,
          expected: perDiemExpected,
        }}
      />
    </div>
  );
}
