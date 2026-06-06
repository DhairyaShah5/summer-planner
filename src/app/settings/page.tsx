import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SettingsForm, type SettingsFormValues } from "./settings-form";
import { ImportFromXlsx } from "./import-from-xlsx";

export const dynamic = "force-dynamic";

const DEFAULTS: SettingsFormValues = {
  vault_cap: 22858,
  usc_gross_baseline: 1760,
  ntt_hourly_rate: 30,
  usc_net_pct: 0.902088,
  ntt_net_pct: 0.926647,
  rent_monthly: 812.25,
  rent_months: 3,
  robinhood_weekly: 100,
  usc_no_rent_vault: 900,
  usc_rent_vault: 600,
  ntt_vault_default: 2100,
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: row } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    const { data: inserted, error } = await supabase
      .from("settings")
      .insert({ user_id: user.id })
      .select("*")
      .single();
    if (error) throw error;
    row = inserted;
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
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="bg-gradient-to-r from-slate-600 via-indigo-500 to-fuchsia-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Edit the assumptions powering paycheck allocation and the dashboard.
        </p>
      </div>

      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Plan assumptions</CardTitle>
          <CardDescription>
            Vault, pay, rent, and allocation rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm initialValues={values} defaults={DEFAULTS} />
        </CardContent>
      </Card>

      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Import from Excel</CardTitle>
          <CardDescription>
            Seed from your existing Excel workbook. Overwrites current settings
            and paychecks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportFromXlsx />
        </CardContent>
      </Card>
    </div>
  );
}
