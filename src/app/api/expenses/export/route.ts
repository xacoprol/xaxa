import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";

export async function GET(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);

  const expenses = await prisma.expense.findMany({
    where: {
      householdId: ctx.household.id,
      date: { gte: from, lte: to },
    },
    include: {
      category: true,
      paidBy: { select: { name: true } },
      splits: { include: { user: { select: { name: true } } } },
    },
    orderBy: { date: "asc" },
  });

  const header = [
    "fecha",
    "titulo",
    "importe",
    "categoria",
    "tipo",
    "pagado_por",
    "nota",
    "reparto",
  ];

  const rows = expenses.map((e) => {
    const splits =
      e.type === "SHARED"
        ? e.splits
            .map((s) => `${s.user.name}:${Number(s.percent)}%`)
            .join("|")
        : "";
    return [
      e.date.toISOString().slice(0, 10),
      csvEscape(e.title || e.category.name),
      Number(e.amount).toFixed(2),
      csvEscape(e.category.name),
      e.type,
      csvEscape(e.paidBy.name),
      csvEscape(e.note ?? ""),
      csvEscape(splits),
    ].join(",");
  });

  const csv = "\uFEFF" + [header.join(","), ...rows].join("\n");
  const filename = `gastos-${year}-${String(month).padStart(2, "0")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
