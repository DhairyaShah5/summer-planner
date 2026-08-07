import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteNav } from "@/components/site-nav";
import { Toaster } from "@/components/ui/sonner";
import { BackgroundFX } from "@/components/redesign/background-fx";
import { ViewModeProvider } from "@/components/view-mode-context";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { isViewMode } from "@/lib/view-mode";
import { CelebrationProvider } from "@/components/celebration/celebration-provider";
import { getGoalStatus } from "@/lib/goal-status";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [viewMode, goalStatus] = await Promise.all([
    isViewMode(),
    getGoalStatus(),
  ]);
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className={`${bricolage.variable} ${instrument.variable} min-h-full flex flex-col`}>
        <Providers>
          <ViewModeProvider viewMode={viewMode}>
            <CelebrationProvider status={goalStatus}>
              <BackgroundFX />
              <SiteNav />
              {viewMode && <ViewOnlyBanner />}
              <main className="flex-1">{children}</main>
              <Toaster />
            </CelebrationProvider>
          </ViewModeProvider>
        </Providers>
      </body>
    </html>
  );
}
