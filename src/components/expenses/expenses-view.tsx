"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CategoryChart } from "./category-chart";
import type { BalanceEdge } from "@/lib/expenses/balance";

type ExpenseRow = {
  id: string;
  amount: string | number;
  date: string | Date;
  note: string | null;
  type: "SHARED" | "INDIVIDUAL";
  category: { name: string; color: string };
  paidBy: { name: string };
};

export function ExpensesView({
  year,
  month,
  total,
  byCategory,
  byPerson,
  balances,
  expenses,
}: {
  year: number;
  month: number;
  total: number;
  byCategory: { name: string; total: number; color: string }[];
  byPerson: { name: string; total: number }[];
  balances: BalanceEdge[];
  expenses: ExpenseRow[];
}) {
  const router = useRouter();

  const label = new Date(year, month - 1, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    router.push(`/gastos?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  }

  async function removeExpense(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-600">
            Gastos
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
            {label.charAt(0).toUpperCase() + label.slice(1)}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <a
            href={`/api/expenses/export?year=${year}&month=${month}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </a>
          <Link href="/gastos/nuevo">
            <Button variant="emerald" size="md">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Añadir</span>
            </Button>
          </Link>
        </div>
      </header>

      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-soft">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-700/80">
          Total del mes
        </p>
        <p className="font-display mt-1 text-4xl font-semibold tracking-tight text-stone-900">
          {formatCurrency(total)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-soft">
          <h2 className="mb-2 text-sm font-semibold text-stone-800">
            Por categoría
          </h2>
          <CategoryChart data={byCategory} />
        </section>

        <section className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-soft">
          <h2 className="mb-3 text-sm font-semibold text-stone-800">
            Por persona (quién pagó)
          </h2>
          <ul className="space-y-2">
            {byPerson.length === 0 && (
              <li className="text-sm text-stone-400">Sin datos</li>
            )}
            {byPerson.map((p) => (
              <li
                key={p.name}
                className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2.5"
              >
                <span className="text-sm font-medium text-stone-700">
                  {p.name}
                </span>
                <span className="text-sm font-semibold text-stone-900">
                  {formatCurrency(p.total)}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="mb-3 mt-6 text-sm font-semibold text-stone-800">
            Quién debe a quién
          </h2>
          {balances.length === 0 ? (
            <p className="text-sm text-stone-400">
              Sin deudas este mes (gastos compartidos)
            </p>
          ) : (
            <ul className="space-y-2">
              {balances.map((b) => (
                <li
                  key={`${b.fromId}-${b.toId}`}
                  className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-sm text-stone-700"
                >
                  <span className="font-medium">{b.fromName}</span> debe{" "}
                  <span className="font-semibold text-emerald-800">
                    {formatCurrency(b.amount)}
                  </span>{" "}
                  a <span className="font-medium">{b.toName}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-stone-800">
          Listado ({expenses.length})
        </h2>
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-soft">
          {expenses.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-stone-400">
              No hay gastos este mes.{" "}
              <Link href="/gastos/nuevo" className="text-emerald-700 underline">
                Añade el primero
              </Link>
            </li>
          )}
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/80"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: e.category.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {e.category.name}
                    {e.note ? (
                      <span className="font-normal text-stone-400">
                        {" "}
                        · {e.note}
                      </span>
                    ) : null}
                  </p>
                  <p className="shrink-0 text-sm font-semibold text-stone-900">
                    {formatCurrency(Number(e.amount))}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-stone-400">
                  {formatDate(e.date)} · {e.paidBy.name} ·{" "}
                  {e.type === "SHARED" ? "Compartido" : "Individual"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Link
                  href={`/gastos/${e.id}`}
                  className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => removeExpense(e.id)}
                  className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
