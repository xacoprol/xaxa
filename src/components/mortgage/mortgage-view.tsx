"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
};

type Entry = {
  id: string;
  title: string;
  description: string | null;
  date: string | Date;
  status: "PENDIENTE" | "EN_CURSO" | "CERRADO";
  createdBy: { name: string };
  attachments: Attachment[];
};

type Mortgage = {
  amount: string | number | null;
  termYears: number | null;
  interestRate: string | number | null;
  bank: string | null;
  signedAt: string | Date | null;
  notes: string | null;
} | null;

const STATUS_LABEL = {
  PENDIENTE: "Pendiente",
  EN_CURSO: "En curso",
  CERRADO: "Cerrado",
} as const;

const STATUS_STYLE = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  EN_CURSO: "bg-sky-100 text-sky-800",
  CERRADO: "bg-stone-100 text-stone-600",
} as const;

export function MortgageView({
  mortgage,
  entries,
  inviteCode,
}: {
  mortgage: Mortgage;
  entries: Entry[];
  inviteCode: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showMortgageForm, setShowMortgageForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"PENDIENTE" | "EN_CURSO" | "CERRADO">(
    "PENDIENTE"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mortgage ficha
  const [amount, setAmount] = useState(
    mortgage?.amount != null ? String(mortgage.amount) : ""
  );
  const [termYears, setTermYears] = useState(
    mortgage?.termYears != null ? String(mortgage.termYears) : ""
  );
  const [interestRate, setInterestRate] = useState(
    mortgage?.interestRate != null ? String(mortgage.interestRate) : ""
  );
  const [bank, setBank] = useState(mortgage?.bank ?? "");
  const [signedAt, setSignedAt] = useState(
    mortgage?.signedAt
      ? new Date(mortgage.signedAt).toISOString().slice(0, 10)
      : ""
  );
  const [notes, setNotes] = useState(mortgage?.notes ?? "");

  async function createEntry(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/mortgage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, date, status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error");
      setLoading(false);
      return;
    }
    setTitle("");
    setDescription("");
    setShowForm(false);
    setLoading(false);
    router.refresh();
  }

  async function saveMortgage(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/mortgage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amount ? parseFloat(amount) : null,
        termYears: termYears ? parseInt(termYears, 10) : null,
        interestRate: interestRate ? parseFloat(interestRate) : null,
        bank: bank || null,
        signedAt: signedAt || null,
        notes: notes || null,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setShowMortgageForm(false);
      router.refresh();
    }
  }

  async function updateStatus(
    id: string,
    next: "PENDIENTE" | "EN_CURSO" | "CERRADO"
  ) {
    await fetch(`/api/mortgage/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
  }

  async function removeEntry(id: string) {
    if (!confirm("¿Eliminar esta entrada?")) return;
    await fetch(`/api/mortgage/entries/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function uploadFile(entryId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/mortgage/entries/${entryId}/attachments`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Error al subir");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-sky-600">
            Hipoteca
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
            Expediente
          </h1>
        </div>
        <Button variant="sky" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          Nueva entrada
        </Button>
      </header>

      {/* Ficha hipoteca */}
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-stone-900">
              Datos de la hipoteca
            </h2>
            <p className="text-sm text-stone-500">
              Ficha fija una vez firmada / en proceso
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMortgageForm((v) => !v)}
            className="text-sm font-medium text-sky-700 underline"
          >
            {showMortgageForm ? "Cerrar" : "Editar"}
          </button>
        </div>

        {!showMortgageForm ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Fact
              label="Importe"
              value={
                mortgage?.amount != null
                  ? formatCurrency(Number(mortgage.amount))
                  : "—"
              }
            />
            <Fact
              label="Plazo"
              value={mortgage?.termYears ? `${mortgage.termYears} años` : "—"}
            />
            <Fact
              label="Interés"
              value={
                mortgage?.interestRate != null
                  ? `${Number(mortgage.interestRate)}%`
                  : "—"
              }
            />
            <Fact label="Entidad" value={mortgage?.bank || "—"} />
            <Fact
              label="Firma"
              value={
                mortgage?.signedAt ? formatDate(mortgage.signedAt) : "—"
              }
            />
            <Fact label="Notas" value={mortgage?.notes || "—"} />
          </dl>
        ) : (
          <form onSubmit={saveMortgage} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                id="amount"
                label="Importe (€)"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Input
                id="term"
                label="Plazo (años)"
                type="number"
                value={termYears}
                onChange={(e) => setTermYears(e.target.value)}
              />
              <Input
                id="rate"
                label="Tipo interés (%)"
                type="number"
                step="0.001"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
              <Input
                id="bank"
                label="Entidad"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
              />
              <Input
                id="signed"
                label="Fecha de firma"
                type="date"
                value={signedAt}
                onChange={(e) => setSignedAt(e.target.value)}
              />
            </div>
            <Textarea
              id="notes"
              label="Notas"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button type="submit" variant="sky" loading={loading}>
              Guardar ficha
            </Button>
          </form>
        )}
      </section>

      {showForm && (
        <form
          onSubmit={createEntry}
          className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft"
        >
          <Input
            id="title"
            label="Título"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            id="desc"
            label="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id="date"
              label="Fecha"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Select
              id="status"
              label="Estado"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as typeof status)
              }
            >
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_CURSO">En curso</option>
              <option value="CERRADO">Cerrado</option>
            </Select>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <Button type="submit" variant="sky" loading={loading}>
            Crear entrada
          </Button>
        </form>
      )}

      {/* Timeline */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-400">
          Timeline
        </h2>
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-400">
            Aún no hay entradas en el expediente
          </p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-sky-100 pl-6">
            {entries.map((entry) => (
              <li key={entry.id} className="relative">
                <span
                  className={`absolute -left-[1.9rem] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${
                    entry.status === "PENDIENTE"
                      ? "bg-amber-400"
                      : entry.status === "EN_CURSO"
                        ? "bg-sky-500"
                        : "bg-stone-300"
                  }`}
                />
                <article
                  className={`rounded-2xl border bg-white p-4 shadow-soft ${
                    entry.status === "PENDIENTE"
                      ? "border-amber-200"
                      : "border-stone-200/80"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-stone-400">
                        {formatDate(entry.date)} · {entry.createdBy.name}
                      </p>
                      <h3 className="mt-0.5 font-semibold text-stone-900">
                        {entry.title}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[entry.status]}`}
                    >
                      {STATUS_LABEL[entry.status]}
                    </span>
                  </div>
                  {entry.description && (
                    <p className="mt-2 text-sm text-stone-600">
                      {entry.description}
                    </p>
                  )}

                  {entry.attachments.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {entry.attachments.map((a) => (
                        <li key={a.id}>
                          <a
                            href={a.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-sky-700 underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {a.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Select
                      value={entry.status}
                      onChange={(e) =>
                        updateStatus(
                          entry.id,
                          e.target.value as Entry["status"]
                        )
                      }
                      className="h-8 w-auto text-xs"
                    >
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="EN_CURSO">En curso</option>
                      <option value="CERRADO">Cerrado</option>
                    </Select>
                    <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-stone-200 px-2 text-xs font-medium text-stone-600 hover:bg-stone-50">
                      <Paperclip className="h-3.5 w-3.5" />
                      Adjuntar
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadFile(entry.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className="ml-auto rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="rounded-xl bg-stone-100 px-3 py-2 text-xs text-stone-500">
        Código de invitación del hogar:{" "}
        <code className="font-mono text-stone-800">{inviteCode}</code>
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-stone-800">{value}</dd>
    </div>
  );
}
