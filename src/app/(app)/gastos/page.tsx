import { requireHousehold } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeBalances } from "@/lib/expenses/balance";
import { ExpensesView } from "@/components/expenses/expenses-view";

export default async function GastosPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const { household, members } = await requireHousehold();

  const now = new Date();
  const year = Number(searchParams.year ?? now.getFullYear());
  const month = Number(searchParams.month ?? now.getMonth() + 1);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);

  const expenses = await prisma.expense.findMany({
    where: {
      householdId: household.id,
      date: { gte: from, lte: to },
    },
    include: {
      category: true,
      paidBy: { select: { id: true, name: true } },
      splits: true,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const byCategoryMap = new Map<string, { name: string; total: number; color: string }>();
  for (const e of expenses) {
    const prev = byCategoryMap.get(e.categoryId);
    if (prev) prev.total += Number(e.amount);
    else
      byCategoryMap.set(e.categoryId, {
        name: e.category.name,
        total: Number(e.amount),
        color: e.category.color,
      });
  }
  const byCategory = Array.from(byCategoryMap.values()).sort(
    (a, b) => b.total - a.total
  );

  const byPersonMap = new Map<string, number>();
  for (const e of expenses) {
    byPersonMap.set(
      e.paidBy.name,
      (byPersonMap.get(e.paidBy.name) ?? 0) + Number(e.amount)
    );
  }
  const byPerson = Array.from(byPersonMap.entries())
    .map(([name, t]) => ({ name, total: t }))
    .sort((a, b) => b.total - a.total);

  const balances = computeBalances(
    expenses.map((e) => ({
      amount: e.amount,
      type: e.type,
      paidById: e.paidById,
      splits: e.splits.map((s) => ({
        userId: s.userId,
        percent: s.percent,
      })),
    })),
    members.map((m) => ({ userId: m.userId, name: m.user.name }))
  );

  return (
    <ExpensesView
      year={year}
      month={month}
      total={total}
      byCategory={byCategory}
      byPerson={byPerson}
      balances={balances}
      expenses={expenses.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        date: e.date,
        note: e.note,
        type: e.type,
        category: { name: e.category.name, color: e.category.color },
        paidBy: { name: e.paidBy.name },
      }))}
    />
  );
}
