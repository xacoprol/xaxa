"use client";

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
import { useEffect, useState, useTransition } from "react";
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

const ME_KEY = "xaxa-me";

type MeInfo = { userName: string; householdName: string };

function readMeCache(): MeInfo | null {
  try {
    const raw = sessionStorage.getItem(ME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MeInfo;
    if (parsed?.userName && parsed?.householdName) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function writeMeCache(info: MeInfo) {
  try {
    sessionStorage.setItem(ME_KEY, JSON.stringify(info));
  } catch {
    // ignore
  }
}

function isActivePath(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href))
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [isPending, startTransition] = useTransition();
  const [displayPath, setDisplayPath] = useState(pathname);

  useEffect(() => {
    setDisplayPath(pathname);
  }, [pathname]);

  useEffect(() => {
    const cached = readMeCache();
    if (cached) setMe(cached);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = (await res.json()) as MeInfo;
        if (cancelled || !data.userName) return;
        writeMeCache(data);
        setMe(data);
      } catch {
        // shell works without names
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Precarga TODAS las secciones al entrar (y al volver a la app)
  useEffect(() => {
    function warm() {
      for (const item of nav) {
        router.prefetch(item.href);
      }
    }
    warm();
    const onFocus = () => warm();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") warm();
    });
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [router]);

  function go(href: string) {
    if (isActivePath(pathname, href) && !isPending) {
      setOpen(false);
      return;
    }
    setOpen(false);
    setDisplayPath(href); // pestaña activa al instante
    startTransition(() => {
      router.push(href);
    });
  }

  async function signOut() {
    try {
      sessionStorage.removeItem(ME_KEY);
    } catch {
      // ignore
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const householdName = me?.householdName ?? "";
  const userName = me?.userName ?? "";
  const activePath = displayPath;

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#eef7f4_0%,_#f4f7f6_45%,_#e2ebe8_100%)]">
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
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
              {householdName ? (
                <span className="hidden text-xs font-medium uppercase tracking-widest text-stone-400 sm:inline">
                  {householdName}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userName ? (
              <span className="hidden text-sm text-stone-500 sm:inline">
                {userName}
              </span>
            ) : null}
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

        {open && (
          <nav className="border-t border-stone-100 bg-white px-4 py-3 md:hidden">
            <ul className="space-y-1">
              {nav.map((item) => {
                const active = isActivePath(activePath, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <button
                      type="button"
                      onClick={() => go(item.href)}
                      onPointerEnter={() => router.prefetch(item.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium",
                        active
                          ? "bg-navy text-white"
                          : "text-stone-600 hover:bg-stone-50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>

      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-6 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-8">
        <aside className="hidden w-48 shrink-0 md:block">
          <nav className="sticky top-[calc(5rem+env(safe-area-inset-top))] space-y-1">
            {nav.map((item) => {
              const active = isActivePath(activePath, item.href);
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => go(item.href)}
                  onPointerEnter={() => router.prefetch(item.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
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
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="relative min-w-0 flex-1">
          <div
            className={cn(
              "transition-opacity duration-150",
              isPending && "pointer-events-none select-none opacity-45"
            )}
          >
            {children}
          </div>
          {isPending && (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10"
              aria-hidden
            >
              <div className="h-0.5 overflow-hidden rounded-full bg-stone-200/70">
                <div className="h-full w-2/5 animate-[pulse_0.9s_ease-in-out_infinite] rounded-full bg-teal" />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Tab bar fija — cristal iOS */}
      <nav
        aria-label="Secciones"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden"
        style={{
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
        }}
      >
        <div className="pointer-events-auto flex justify-center px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <ul
            className={cn(
              "ios-glass flex w-full max-w-[21rem] items-stretch gap-0.5 p-1.5",
              "rounded-full"
            )}
          >
            {nav.map((item) => {
              const active = isActivePath(activePath, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href} className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => go(item.href)}
                    onPointerEnter={() => router.prefetch(item.href)}
                    onTouchStart={() => router.prefetch(item.href)}
                    className={cn(
                      "flex w-full flex-col items-center gap-0.5 rounded-full px-1 py-2 text-[10px] font-medium transition-all duration-200",
                      active
                        ? "bg-white/70 text-navy shadow-[0_1px_4px_rgba(16,32,56,0.08)]"
                        : "text-stone-500/90 active:bg-white/35"
                    )}
                  >
                    <Icon
                      className={cn("h-5 w-5", active && "stroke-[2.35px]")}
                    />
                    <span className="truncate leading-none">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </div>
  );
}
