"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <Sun className="size-5 text-primary" />
          <span>Summer Planner</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({
                    variant: active ? "secondary" : "ghost",
                    size: "sm",
                  }),
                  "gap-2",
                  active && "font-medium"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <nav className="flex md:hidden items-center gap-1 ml-2 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  buttonVariants({
                    variant: active ? "secondary" : "ghost",
                    size: "icon-sm",
                  })
                )}
              >
                <Icon className="size-4" />
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm" className="gap-2">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
