import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import type { VaultGrowthPoint } from "./dashboard-tiles";
import { todayInUserTz } from "@/lib/today";

import { getViewerContext } from "@/lib/viewer-context";
import {
  computeAll,
  computeAccountStates,
  summarize,
  CO_SURPLUS_SWEEP_KINDS,
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
import { PurposeFulfilledHero } from "@/components/celebration/purpose-fulfilled-hero";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, userId } = await getViewerContext();

  let { data: settingsRow } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!settingsRow) {
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
      rentAmountOverride:
        overrides.rent_amount != null ? Number(overrides.rent_amount) : null,
      coOverride: overrides.co_amount != null ? Number(overrides.co_amount) : null,
      bofaOverride:
        overrides.bofa_overflow != null ? Number(overrides.bofa_overflow) : null,
      robinhoodOverride:
        overrides.robinhood_amount != null
          ? Number(overrides.robinhood_amount)
          : null,
      received: p.received,
    };
  });

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
      .select("amount, count_in_co_budget, refund_expected")
      .lte("expense_date", todayISO),
    supabase
      .from("accounts")
      .select(
        "id, name, type, arrival_balance, display_order, is_paycheck_destination, is_vault",
      )
      .order("display_order", { ascending: true }),
    supabase
      .from("expenses")
      .select(
        "id, expense_date, amount, account_id, refund_expected, refund_settled",
      ),
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
    refund_expected:
      e.refund_expected != null ? Number(e.refund_expected) : null,
    refund_settled: e.refund_settled ?? false,
    created_at: e.created_at,
  }));

  // Derive live account balances (current = received-paycheck activity +
  // dated expenses + cc payments through today). Then take the top 3 by
  // display_order for the dashboard preview.
  const accountInputs: AccountInput[] = (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as AccountInput['type'],
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
    refund_expected:
      e.refund_expected != null ? Number(e.refund_expected) : null,
    refund_settled: e.refund_settled ?? false,
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

  // Two vault-transfer sums:
  //   - `externalVaultPlanSeed` feeds computeAll; excludes CO-surplus sweeps
  //     so a rollover/buffer sweep does NOT re-shuffle future paycheck vault
  //     contributions (i.e. sweeping doesn't magically boost CO budget).
  //   - `externalVaultBalance` is the true net movement into Marcus and drives
  //     the displayed vault balance + goal-reached check.
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

  let externalVaultBalance = 0;
  let externalVaultPlanSeed = 0;
  if (vaultAccountId) {
    for (const t of transferInputs) {
      const isInflow = t.to_account_id === vaultAccountId;
      const isOutflow = t.from_account_id === vaultAccountId;
      if (!isInflow && !isOutflow) continue;
      const signed = isInflow ? t.amount : -t.amount;
      externalVaultBalance += signed;
      if (!CO_SURPLUS_SWEEP_KINDS.has(t.kind)) externalVaultPlanSeed += signed;
    }
  }

  const computed = computeAll(inputs, settings, externalVaultPlanSeed);
  const totals = summarize(computed, settings);

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

  // Marcus account_entries (e.g. the manual BofA fee-vault payment) don't
  // flow through paychecks or transfers, so the base vault projection here
  // misses them. Layer them in by date the same way CO-surplus sweeps are.
  const vaultEntriesThroughDate = (dateISO: string): number =>
    vaultAccountId
      ? accountEntryInputs
          .filter(
            (e) => e.account_id === vaultAccountId && e.dated_at <= dateISO,
          )
          .reduce((s, e) => s + e.amount, 0)
      : 0;
  const vaultEntriesTotal = vaultAccountId
    ? accountEntryInputs
        .filter((e) => e.account_id === vaultAccountId)
        .reduce((s, e) => s + e.amount, 0)
    : 0;
  const vaultEntriesToDate = vaultEntriesThroughDate(todayISO);


  // Cumulative CO utilization through today. Off-budget expenses
  // (count_in_co_budget === false) are excluded. CO-surplus sweeps
  // (rollover_sweep, buffer_sweep) ARE included — the money left the CO
  // pool for savings, so it counts as utilized budget even though it isn't
  // a consumption expense.
  const cumExpensesSpent = (cumExpensesRes.data ?? [])
    .filter((e) => e.count_in_co_budget !== false)
    .reduce(
      (s, e) =>
        s + ((e.amount ?? 0) - (e.refund_expected ? Number(e.refund_expected) : 0)),
      0,
    );
  // Only rollover sweeps count as CO-utilized here. Buffer sweeps are Chase
  // cushion surplus (wage buffer / reimbursement float), not CO under-spend,
  // so they don't belong in the "spent" side of the CO gauge.
  const cumCoSavedToVault = transferInputs
    .filter(
      (t) =>
        t.kind === 'rollover_sweep' &&
        t.to_account_id === vaultAccountId &&
        t.transferred_at <= todayISO,
    )
    .reduce((s, t) => s + Number(t.amount), 0);
  const cumSpent = cumExpensesSpent + cumCoSavedToVault;

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
  // Wage-clearing BofA sweeps only — vault_topup_sweep kind = banner-driven
  // moves that specifically drain wage overflow. Manual BofA→Marcus transfers
  // are excluded because they usually move arrival-balance or per-diem savings,
  // not the wage-overflow pool this counter is tracking. Both the "Extra in
  // BofA" strip and the vault-topup banner read off this metric so they agree.
  const bofaWageSweeps = vaultAccountId && bofaAccountId
    ? transferInputs
        .filter(
          (t) =>
            t.from_account_id === bofaAccountId &&
            t.to_account_id === vaultAccountId &&
            t.kind === 'vault_topup_sweep',
        )
        .reduce((s, t) => s + t.amount, 0)
    : 0;
  const bofaExtraCurrent = wagesInBofa - bofaWageSweeps;
  // Only `buffer_sweep` transfers drain the wage-buffer pocket. A
  // rollover_sweep also moves Chase → Marcus but drains CO surplus (a
  // different pocket), so counting it here would deflate bufferSurplus
  // and silently hide the sweep banner. Manual Chase → Marcus moves have
  // unknown intent, so we leave them out too and let them float in the
  // raw balance. Mirrors the paychecks page's totalBufferSwept.
  const bufferSweptSoFar = vaultAccountId && chaseAccountId
    ? transferInputs
        .filter(
          (t) =>
            t.kind === 'buffer_sweep' &&
            t.from_account_id === chaseAccountId &&
            t.to_account_id === vaultAccountId,
        )
        .reduce((s, t) => s + t.amount, 0)
    : 0;

  // Date-indexed CO-surplus sweep events (rollover + buffer). These
  // physically sit in Marcus but are deliberately excluded from the plan
  // seed, so r.cumulativeVault doesn't know about them. Layer them onto
  // each row by date so the growth curve and projected total include the
  // money that actually landed.
  const coSurplusVaultEvents = vaultAccountId
    ? transferInputs
        .filter(
          (t) =>
            CO_SURPLUS_SWEEP_KINDS.has(t.kind) &&
            (t.to_account_id === vaultAccountId ||
              t.from_account_id === vaultAccountId),
        )
        .map((t) => ({
          date: t.transferred_at,
          amount:
            t.to_account_id === vaultAccountId ? t.amount : -t.amount,
        }))
    : [];
  const coSurplusThroughDate = (dateISO: string): number =>
    coSurplusVaultEvents
      .filter((e) => e.date <= dateISO)
      .reduce((s, e) => s + e.amount, 0);
  const coSurplusTotal = coSurplusVaultEvents.reduce(
    (s, e) => s + e.amount,
    0,
  );

  // Project future BofA→Vault sweeps into the cumulativeVault series.
  // calc's cumulativeVault only counts scheduled per-paycheck vault transfers
  // (vault + extraDeposit); vault_topup_sweep moves money outside that flow,
  // so it's invisible to the base projection. We layer it in here:
  //   - past sweeps (vaultTopupSwept) lift every row as a baseline shift
  //   - for each future row we accumulate that row's projected wages-only
  //     BofA inflow into a running buffer; when the buffer crosses $1,000 we
  //     simulate a sweep (mirroring the manual banner behavior).
  let projectedFutureSweeps = 0;
  let projectedBofaWagesUnswept = Math.max(0, bofaExtraCurrent);
  const projectedVaultPerRow: number[] = [];
  for (const r of computed) {
    if (!r.received) {
      projectedBofaWagesUnswept += Math.max(0, r.bofaOverflow - r.perDiem);
      // r.cumulativeVault includes externalVaultPlanSeed (seeded into
      // computeAll via prevCumulative). Add CO-surplus sweeps dated on/before
      // this paycheck and the running projected-sweep tally so the "cap
      // headroom" check reflects what's actually left in Marcus.
      const coSurplusHere = coSurplusThroughDate(String(r.payDate));
      const entriesHere = vaultEntriesThroughDate(String(r.payDate));
      const baseAtRow =
        r.cumulativeVault +
        projectedFutureSweeps +
        coSurplusHere +
        entriesHere;
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
        r.cumulativeVault +
          projectedFutureSweeps +
          coSurplusThroughDate(String(r.payDate)) +
          vaultEntriesThroughDate(String(r.payDate)),
      ),
    );
  }

  const currentVaultWithSweeps = Math.min(
    settings.vaultCap,
    totals.currentVault + externalVaultBalance + vaultEntriesToDate,
  );
  // The last row's projectedVaultPerRow only includes CO-surplus sweeps
  // dated on/before that paycheck; guard against a future-dated sweep by
  // taking the max with the full CO-surplus total layered on top.
  const projectedTotalVaultWithSweeps = Math.min(
    settings.vaultCap,
    Math.max(
      projectedVaultPerRow[projectedVaultPerRow.length - 1] ?? 0,
      totals.totalVault +
        projectedFutureSweeps +
        coSurplusTotal +
        vaultEntriesTotal,
    ),
  );

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
  // wages. `label` is always the paycheck date; VaultGrowthTile handles
  // hiding alternate axis ticks via the chart's `xLabel` override so the
  // tooltip still shows the date.
  const vaultGrowthSeries: VaultGrowthPoint[] = computed.map((r, i) => ({
    label: format(new Date(String(r.payDate)), "MMM d"),
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
    Math.floor(Math.max(0, bofaExtraCurrent) / 500) * 500,
    vaultRoomFloored,
  );
  const showTopupBanner = bofaExtraCurrent >= 500 && suggestedTopup > 0;

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
    !!chaseAccountId &&
    !!vaultAccountId;

  // Per diem progress: cumulative received vs full-summer total. Visibility
  // only - never drives an auto-action.
  const perDiemExpected = computed.reduce((s, r) => s + r.perDiem, 0);
  const perDiemReceived = computed
    .filter((r) => r.received)
    .reduce((s, r) => s + r.perDiem, 0);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PurposeFulfilledHero />
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
        deadlineLabel={format(new Date("2026-09-02T12:00:00"), "MMM d")}
        vaultTopup={{
          show: showTopupBanner,
          ready: Math.max(0, bofaExtraCurrent),
          suggested: suggestedTopup,
          fromAccountId: bofaAccountId ?? "",
          toAccountId: vaultAccountId ?? "",
        }}
        bufferSweep={{
          show: showBufferBanner,
          surplus: bufferSurplus,
          suggested: suggestedBufferSweep,
          cushion: bufferCushion,
          fromAccountId: chaseAccountId ?? "",
          toAccountId: vaultAccountId ?? "",
        }}
        perDiem={{
          received: perDiemReceived,
          expected: perDiemExpected,
        }}
        bofaExtra={{
          extra: bofaExtraCurrent,
          wagesDeposited: wagesInBofa,
          wageSweeps: bofaWageSweeps,
        }}
      />
    </div>
  );
}
