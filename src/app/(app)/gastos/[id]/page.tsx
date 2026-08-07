import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHousehold } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default async function EditGastoPage({
  params,
}: {
  params: { id: string };
}) {
  const { user, household, members } = await requireHousehold();

  const [expense, categories] = await Promise.all([
    prisma.expense.findFirst({
      where: { id: params.id, householdId: household.id },
      include: { splits: true },
    }),
    prisma.expenseCategory.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!expense) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <Link
          href="/gastos"
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          ← Gastos
        </Link>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-stone-900">
          Editar gasto
        </h1>
      </header>

      <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-soft">
        <ExpenseForm
          currentUserId={user.id}
          members={members.map((m) => ({
            userId: m.userId,
            name: m.user.name,
          }))}
          categories={categories}
          initial={{
            id: expense.id,
            title: expense.title,
            amount: Number(expense.amount),
            categoryId: expense.categoryId,
            date: expense.date.toISOString().slice(0, 10),
            note: expense.note ?? "",
            type: expense.type,
            paidById: expense.paidById,
            splits: expense.splits.map((s) => ({
              userId: s.userId,
              percent: Number(s.percent),
            })),
          }}
        />
      </div>
    </div>
  );
}
