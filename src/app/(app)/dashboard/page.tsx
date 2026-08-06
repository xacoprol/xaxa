import Link from "next/link";
import {
  endOfMonth,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { Wallet, UtensilsCrossed, Landmark, Plus, AlertCircle } from "lucide-react";
import { requireHousehold } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { MODULE_ACCENTS } from "@/lib/constants";

export default async function DashboardPage() {
  const { household, user } = await requireHousehold();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const dayOfWeek = (now.getDay() + 6) % 7; // lunes=0

  const [expenses, pendingMortgage, weeklyMenu] = await Promise.all([
    prisma.expense.findMany({
      where: {
        householdId: household.id,
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { amount: true },
    }),
    prisma.mortgageEntry.findFirst({
      where: {
        householdId: household.id,
        status: "PENDIENTE",
      },
      orderBy: { date: "asc" },
    }),
    prisma.weeklyMenu.findUnique({
      where: {
        householdId_weekStart: {
          householdId: household.id,
          weekStart,
        },
      },
      include: {
        meals: {
          where: { dayOfWeek },
          orderBy: { mealType: "asc" },
        },
      },
    }),
  ]);

  const monthTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const todayMeals = weeklyMenu?.meals ?? [];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-widest text-stone-400">
          {format(now, "EEEE d MMMM", { locale: es })}
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-stone-900">
          Hola, {user.name.split(" ")[0]}
        </h1>
      </header>

      {/* Quick summary */}
      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryTile
          href="/gastos"
          label="Gasto del mes"
          value={formatCurrency(monthTotal)}
          accent={MODULE_ACCENTS.expenses.hex}
          icon={<Wallet className="h-4 w-4" />}
        />
        <SummaryTile
          href="/menus"
          label="Menú de hoy"
          value={
            todayMeals.length
              ? todayMeals.map((m) => m.name).join(" · ")
              : "Sin menú"
          }
          accent={MODULE_ACCENTS.menus.hex}
          icon={<UtensilsCrossed className="h-4 w-4" />}
          smallValue
        />
        <SummaryTile
          href="/hipoteca"
          label="Hipoteca pendiente"
          value={pendingMortgage?.title ?? "Todo al día"}
          accent={MODULE_ACCENTS.mortgage.hex}
          icon={
            pendingMortgage ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Landmark className="h-4 w-4" />
            )
          }
          highlight={!!pendingMortgage}
          smallValue
        />
      </section>

      {/* Module shortcuts */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-stone-400">
          Módulos
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <ModuleCard
            href="/gastos"
            title="Gastos"
            description="Control mensual y balances"
            accent={MODULE_ACCENTS.expenses.hex}
            cta="Añadir gasto"
            ctaHref="/gastos/nuevo"
          />
          <ModuleCard
            href="/menus"
            title="Menús"
            description="Semana con IA y lista de compra"
            accent={MODULE_ACCENTS.menus.hex}
            cta="Ver menú"
            ctaHref="/menus"
          />
          <ModuleCard
            href="/hipoteca"
            title="Hipoteca"
            description="Expediente y documentación"
            accent={MODULE_ACCENTS.mortgage.hex}
            cta="Ver expediente"
            ctaHref="/hipoteca"
          />
        </div>
      </section>

      {pendingMortgage && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-sky-100 p-2 text-sky-700">
              <Landmark className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-sky-600">
                Pendiente ·{" "}
                {format(pendingMortgage.date, "d MMM", { locale: es })}
              </p>
              <p className="mt-0.5 font-medium text-stone-900">
                {pendingMortgage.title}
              </p>
              {pendingMortgage.description && (
                <p className="mt-1 line-clamp-2 text-sm text-stone-600">
                  {pendingMortgage.description}
                </p>
              )}
              <Link
                href="/hipoteca"
                className="mt-2 inline-block text-sm font-medium text-sky-700 underline"
              >
                Ir al expediente
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryTile({
  href,
  label,
  value,
  accent,
  icon,
  smallValue,
  highlight,
}: {
  href: string;
  label: string;
  value: string;
  accent: string;
  icon: React.ReactNode;
  smallValue?: boolean;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-md ${
        highlight ? "border-sky-300" : "border-stone-200/80"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-stone-400">
          {label}
        </span>
        <span
          className="rounded-md p-1.5 text-white"
          style={{ backgroundColor: accent }}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-3 font-semibold text-stone-900 ${
          smallValue
            ? "line-clamp-2 text-base leading-snug"
            : "font-display text-2xl tracking-tight"
        }`}
      >
        {value}
      </p>
    </Link>
  );
}

function ModuleCard({
  href,
  title,
  description,
  accent,
  cta,
  ctaHref,
}: {
  href: string;
  title: string;
  description: string;
  accent: string;
  cta: string;
  ctaHref: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-5 shadow-soft">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accent }}
      />
      <Link href={href}>
        <h3 className="font-display text-xl font-semibold text-stone-900">
          {title}
        </h3>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </Link>
      <Link
        href={ctaHref}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-800 hover:underline"
      >
        <Plus className="h-3.5 w-3.5" />
        {cta}
      </Link>
    </div>
  );
}
