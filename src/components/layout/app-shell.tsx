"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Wallet,
  UtensilsCrossed,
  Landmark,
  LogOut,
  Menu,
  X,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { MODULE_ACCENTS } from "@/lib/constants";

const nav = [
  { href: "/dashboard", label: "Inicio", icon: Home, accent: null },
  {
    href: "/gastos",
    label: "Gastos",
    icon: Wallet,
    accent: MODULE_ACCENTS.expenses,
  },
  {
    href: "/menus",
    label: "Menús",
    icon: UtensilsCrossed,
    accent: MODULE_ACCENTS.menus,
  },
  {
    href: "/hipoteca",
    label: "Hipoteca",
    icon: Landmark,
    accent: MODULE_ACCENTS.mortgage,
  },
  {
    href: "/configuracion",
    label: "Ajustes",
    icon: Settings,
    accent: null,
  },
] as const;

export function AppShell({
  children,
  userName,
  householdName,
}: {
  children: React.ReactNode;
  userName: string;
  householdName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#eef7f4_0%,_#f4f7f6_45%,_#e2ebe8_100%)]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menú"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2.5">
              <BrandLogo href="/dashboard" size="sm" />
              <span className="hidden text-xs font-medium uppercase tracking-widest text-stone-400 sm:inline">
                {householdName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-stone-500 sm:inline">
              {userName}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-navy"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {open && (
          <nav className="border-t border-stone-100 bg-white px-4 py-3 md:hidden">
            <ul className="space-y-1">
              {nav.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                        active
                          ? "bg-navy text-white"
                          : "text-stone-600 hover:bg-stone-50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>

      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-6 pb-24 md:pb-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-48 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-navy text-white shadow-sm"
                      : "text-stone-600 hover:bg-white hover:text-navy"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {active && item.accent && (
                    <span
                      className="ml-auto h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: item.accent.hex }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur-md md:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                    active ? "text-navy" : "text-stone-400"
                  )}
                >
                  <Icon
                    className={cn("h-5 w-5", active && "stroke-[2.25px]")}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
