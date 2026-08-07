"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Member = { userId: string; name: string };
type Category = { id: string; name: string; color: string };

type SplitState = { userId: string; percent: number };

export type ExpenseFormInitial = {
  id?: string;
  title: string;
  amount: number;
  categoryId: string;
  date: string;
  note: string;
  type: "SHARED" | "INDIVIDUAL";
  paidById: string;
  splits: SplitState[];
};

export function ExpenseForm({
  members,
  categories,
  currentUserId,
  initial,
}: {
  members: Member[];
  categories: Category[];
  currentUserId: string;
  initial?: ExpenseFormInitial;
}) {
  const router = useRouter();
  const equal = useMemo(() => {
    const base = Math.floor(10000 / members.length) / 100;
    const splits = members.map((m) => ({ userId: m.userId, percent: base }));
    const diff = 100 - splits.reduce((s, x) => s + x.percent, 0);
    if (splits[0])
      splits[0].percent = Math.round((splits[0].percent + diff) * 100) / 100;
    return splits;
  }, [members]);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categories[0]?.id ?? ""
  );
  const [date, setDate] = useState(
    initial?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [type, setType] = useState<"SHARED" | "INDIVIDUAL">(
    initial?.type ?? "SHARED"
  );
  const [paidById, setPaidById] = useState(
    initial?.paidById ?? currentUserId
  );
  const [splits, setSplits] = useState<SplitState[]>(
    initial?.splits?.length ? initial.splits : equal
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const splitTotal = splits.reduce((s, x) => s + x.percent, 0);

  function updateSplit(userId: string, percent: number) {
    setSplits((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, percent } : s))
    );
  }

  function distributeEqual() {
    setSplits(equal);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!title.trim()) {
      setError("Pon un título al gasto");
      setLoading(false);
      return;
    }

    if (type === "SHARED" && Math.abs(splitTotal - 100) > 0.05) {
      setError("Los porcentajes del reparto deben sumar 100%");
      setLoading(false);
      return;
    }

    const payload = {
      title: title.trim(),
      amount: parseFloat(amount),
      categoryId,
      date,
      note: note || null,
      type,
      paidById,
      splits: type === "SHARED" ? splits : [],
    };

    const url = initial?.id
      ? `/api/expenses/${initial.id}`
      : "/api/expenses";
    const method = initial?.id ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      setLoading(false);
      return;
    }

    router.push("/gastos");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Input
        id="title"
        label="Título"
        placeholder="Ej.: Compra semanal, cena, gasolina…"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus={!initial?.id}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="amount"
          label="Importe (€)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          id="date"
          label="Fecha"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <Select
        id="category"
        label="Categoría"
        required
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      <Select
        id="paidBy"
        label="Quién pagó"
        required
        value={paidById}
        onChange={(e) => setPaidById(e.target.value)}
      >
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </Select>

      <div>
        <p className="mb-1.5 text-sm font-medium text-stone-700">Tipo</p>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
          {(
            [
              ["SHARED", "Compartido"],
              ["INDIVIDUAL", "Individual"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                type === value
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {type === "SHARED" && (
        <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-teal-900">
              Reparto por porcentaje
            </p>
            <button
              type="button"
              onClick={distributeEqual}
              className="text-xs font-medium text-teal-700 underline"
            >
              Equitativo
            </button>
          </div>
          <div className="space-y-3">
            {members.map((m) => {
              const split = splits.find((s) => s.userId === m.userId);
              return (
                <div key={m.userId} className="flex items-center gap-3">
                  <span className="w-28 truncate text-sm text-stone-700">
                    {m.name}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={split?.percent ?? 0}
                    onChange={(e) =>
                      updateSplit(m.userId, parseFloat(e.target.value) || 0)
                    }
                    className="h-9 w-24 rounded-lg border border-stone-200 bg-white px-2 text-sm"
                  />
                  <span className="text-sm text-stone-400">%</span>
                </div>
              );
            })}
          </div>
          <p
            className={`mt-3 text-xs ${
              Math.abs(splitTotal - 100) < 0.05
                ? "text-teal-700"
                : "text-amber-700"
            }`}
          >
            Total: {splitTotal.toFixed(2)}%
          </p>
        </div>
      )}

      <Textarea
        id="note"
        label="Nota (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
      />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="teal" className="flex-1" loading={loading}>
          {initial?.id ? "Guardar" : "Añadir gasto"}
        </Button>
      </div>
    </form>
  );
}
