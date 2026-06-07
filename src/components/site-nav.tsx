"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  Wallet,
  Receipt,
  CalendarDays,
  Settings,
  LogOut,
  Sun,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { VaultMini } from "@/components/redesign/vault-mini";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/paychecks", label: "Paychecks", icon: Wallet },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/weekly", label: "Weekly", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SiteNavProps = {
  vault?: { currentVault: number; vaultCap: number } | null;
};

export function SiteNav({ vault }: SiteNavProps = {}) {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur"
      style={{
        background: "color-mix(in oklch, var(--surface, var(--background)) 80%, transparent)",
        borderBottom: "1px solid var(--hair, var(--border))",
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
          aria-label="Summer Planner home"
        >
          <motion.span
            whileHover={{ rotate: 90, scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 220, damping: 14 }}
            className="inline-flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background:
                "linear-gradient(135deg, var(--gold, #f5c66b), var(--accent))",
              boxShadow:
                "0 0 0 1px color-mix(in oklch, var(--accent) 35%, transparent), 0 4px 14px color-mix(in oklch, var(--accent) 30%, transparent)",
            }}
          >
            <Sun size={16} color="#fff" />
          </motion.span>
          <span
            className="hidden sm:inline"
            style={{
              font: "700 16px var(--font-display, var(--display))",
              letterSpacing: "-0.01em",
              color: "var(--ink-1, var(--foreground))",
            }}
          >
            Summer Planner
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <motion.div
                key={item.href}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 transition-colors",
                  )}
                  style={{
                    borderRadius: 999,
                    background: active
                      ? "color-mix(in oklch, var(--accent) 14%, transparent)"
                      : "transparent",
                    color: active
                      ? "var(--ink-1, var(--foreground))"
                      : "var(--ink-3, var(--muted-foreground))",
                    fontFamily: "var(--font-ui, var(--ui))",
                    fontSize: 13.5,
                    fontWeight: active ? 600 : 500,
                    border: active
                      ? "1px solid color-mix(in oklch, var(--accent) 28%, transparent)"
                      : "1px solid transparent",
                  }}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <nav className="ml-2 flex items-center gap-1 overflow-x-auto md:hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <motion.div key={item.href} whileTap={{ scale: 0.92 }}>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: active
                      ? "color-mix(in oklch, var(--accent) 14%, transparent)"
                      : "transparent",
                    color: active
                      ? "var(--ink-1, var(--foreground))"
                      : "var(--ink-3, var(--muted-foreground))",
                    border: active
                      ? "1px solid color-mix(in oklch, var(--accent) 28%, transparent)"
                      : "1px solid transparent",
                  }}
                >
                  <Icon size={16} />
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {vault ? (
            <div className="hidden sm:block">
              <VaultMini
                currentVault={vault.currentVault}
                vaultCap={vault.vaultCap}
              />
            </div>
          ) : null}
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="gap-2 transition-colors hover:bg-muted"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </motion.div>
          </form>
        </div>
      </div>
    </header>
  );
}
