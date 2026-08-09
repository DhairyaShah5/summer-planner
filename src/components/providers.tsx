"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { SerwistProvider } from "@serwist/turbopack/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RealtimeSync } from "@/lib/use-realtime-sync";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
        >
          <TooltipProvider delay={150}>
            <RealtimeSync />
            {children}
          </TooltipProvider>
        </SerwistProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
