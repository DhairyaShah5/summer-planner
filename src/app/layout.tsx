import type { Metadata, Viewport } from "next";
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
  manifest: "/manifest.webmanifest",
  applicationName: "Vault",
  appleWebApp: {
    capable: true,
    title: "Vault",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1812",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

// The layout probes `getGoalStatus()` which reads live paycheck state, so
// prevent Next from caching the wrapper — otherwise crossing the goal wouldn't
// surface the modal until the next full navigation refresh.
export const dynamic = 'force-dynamic';

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
