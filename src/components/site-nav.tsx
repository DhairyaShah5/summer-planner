"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  CalendarDays,
  Settings,
  LogOut,
  Sun,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/paychecks", label: "Paychecks", icon: Wallet },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/weekly", label: "Weekly", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-90"
        >
          <motion.span
            whileHover={{ rotate: 90, scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 220, damping: 14 }}
            className="inline-flex"
          >
            <Sun className="size-5 text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
          </motion.span>
          <span className="bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
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
                    buttonVariants({
                      variant: active ? "secondary" : "ghost",
                      size: "sm",
                    }),
                    "gap-2 transition-colors",
                    active && "font-medium",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4" />
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
              <motion.div
                key={item.href}
                whileTap={{ scale: 0.92 }}
              >
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    buttonVariants({
                      variant: active ? "secondary" : "ghost",
                      size: "icon-sm",
                    }),
                    "transition-colors",
                  )}
                >
                  <Icon className="size-4" />
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
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
