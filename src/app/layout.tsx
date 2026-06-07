import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteNav } from "@/components/site-nav";
import { Toaster } from "@/components/ui/sonner";
import { BackgroundFX } from "@/components/redesign/background-fx";
import { createClient } from "@/lib/supabase/server";
import {
  computeAll,
  summarize,
  type Settings,
  type PaycheckInput,
  type Employer,
} from "@/lib/calc";

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const instrument = Instrument_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Summer Planner",
  description: "Paycheck allocation and expense tracker for summer 2026",
};

async function loadVaultSummary(): Promise<{
  currentVault: number;
  vaultCap: number;
} | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: settingsRow } = await supabase
      .from("settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!settingsRow) return null;

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
      reimbursement: p.reimbursement,
      extraDeposit: p.extra_deposit,
      vaultOverride: p.vault_override,
      grossOverride: p.gross_override,
      rentPaid: p.rent_paid,
      received: p.received,
    }));

    const computed = computeAll(inputs, settings);
    const totals = summarize(computed, settings);

    return {
      currentVault: totals.currentVault,
      vaultCap: settings.vaultCap,
    };
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const vault = await loadVaultSummary();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className={`${bricolage.variable} ${instrument.variable} min-h-full flex flex-col`}>
        <Providers>
          <BackgroundFX />
          <SiteNav vault={vault} />
          <main className="flex-1">{children}</main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
