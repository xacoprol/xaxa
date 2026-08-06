import Link from "next/link";
import { requireHousehold } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default async function NuevoGastoPage() {
  const { user, household, members } = await requireHousehold();

  const categories = await prisma.expenseCategory.findMany({
    where: { householdId: household.id },
    orderBy: { name: "asc" },
  });

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
          Nuevo gasto
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
        />
      </div>
    </div>
  );
}
