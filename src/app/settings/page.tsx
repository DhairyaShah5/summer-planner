import { getViewerContext } from "@/lib/viewer-context";
import { SettingsForm, type SettingsFormValues } from "./settings-form";
import { ImportFromXlsx } from "./import-from-xlsx";
import { PageHeader, Reveal } from "@/components/redesign";

export const dynamic = "force-dynamic";

const DEFAULTS: SettingsFormValues = {
  vault_cap: 20000,
  usc_gross_baseline: 1760,
  ntt_hourly_rate: 30,
  usc_net_pct: 0.902088,
  ntt_net_pct: 0.82,
  rent_monthly: 812.25,
  rent_months: 3,
  robinhood_weekly: 100,
  usc_no_rent_vault: 1000,
  usc_rent_vault: 400,
  ntt_vault_default: 1800,
  rollover_sweep_threshold: 500,
  rollover_sweep_cushion: 250,
  buffer_sweep_threshold: 500,
  buffer_sweep_cushion: 200,
};

export default async function SettingsPage() {
  const { supabase, userId } = await getViewerContext();

  let { data: row } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    const { data: inserted, error } = await supabase
      .from("settings")
      .insert({ user_id: userId })
      .select("*")
      .single();
    if (error) throw error;
    row = inserted;
  }

  if (!row) {
    return (
      <div className="settings-page mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Settings"
          subtitle="Goal, employers, and how each paycheck cascades into buckets."
        />
        <p style={{ color: "var(--ink-3)", marginTop: 24 }}>
          No settings configured yet.
        </p>
      </div>
    );
  }

  const values: SettingsFormValues = {
    vault_cap: Number(row.vault_cap),
    usc_gross_baseline: Number(row.usc_gross_baseline),
    ntt_hourly_rate: Number(row.ntt_hourly_rate),
    usc_net_pct: Number(row.usc_net_pct),
    ntt_net_pct: Number(row.ntt_net_pct),
    rent_monthly: Number(row.rent_monthly),
    rent_months: Number(row.rent_months),
    robinhood_weekly: Number(row.robinhood_weekly),
    usc_no_rent_vault: Number(row.usc_no_rent_vault),
    usc_rent_vault: Number(row.usc_rent_vault),
    ntt_vault_default: Number(row.ntt_vault_default),
    rollover_sweep_threshold: Number(row.rollover_sweep_threshold),
    rollover_sweep_cushion: Number(row.rollover_sweep_cushion),
    buffer_sweep_threshold: Number(row.buffer_sweep_threshold ?? 500),
    buffer_sweep_cushion: Number(row.buffer_sweep_cushion ?? 200),
  };

  return (
    <div className="settings-page mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Settings"
        subtitle="Goal, employers, and how each paycheck cascades into buckets."
      />
      <SettingsForm initialValues={values} defaults={DEFAULTS} />
      <Reveal delay={300}>
        <div
          className="fx-card settings-maint"
          style={{
            marginTop: 16,
            padding: 22,
            background: "var(--surface)",
            border: "1px solid var(--hair)",
            borderRadius: "var(--radius)",
          }}
        >
          <div
            style={{
              font: "600 12px/1 var(--ui)",
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
              marginBottom: 14,
            }}
          >
            Maintenance · Import from Excel
          </div>
          <p
            style={{
              font: "400 13.5px/1.5 var(--ui)",
              color: "var(--ink-3)",
              margin: "0 0 14px",
            }}
          >
            Seed from your existing Excel workbook. Overwrites current settings
            and paychecks.
          </p>
          <ImportFromXlsx />
        </div>
      </Reveal>
      <style>{`
        @media (max-width: 640px) {
          .settings-page { padding-left: 12px !important; padding-right: 12px !important; padding-top: 16px !important; padding-bottom: 24px !important; }
          .settings-page .fx-card { padding: 14px !important; }
        }
      `}</style>
    </div>
  );
}
