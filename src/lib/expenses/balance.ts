import { Decimal } from "@prisma/client/runtime/library";

export type BalanceEdge = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
};

type SplitInput = {
  userId: string;
  percent: number | Decimal;
};

type ExpenseInput = {
  amount: number | Decimal;
  type: "SHARED" | "INDIVIDUAL";
  paidById: string;
  splits: SplitInput[];
};

type MemberInput = {
  userId: string;
  name: string;
};

/**
 * Calcula "quién debe a quién" a partir de gastos compartidos.
 * Cada persona debería haber pagado su parte (%); si pagó de más, otros le deben.
 */
export function computeBalances(
  expenses: ExpenseInput[],
  members: MemberInput[]
): BalanceEdge[] {
  const net: Record<string, number> = {};
  for (const m of members) net[m.userId] = 0;

  for (const expense of expenses) {
    if (expense.type !== "SHARED") continue;
    const amount =
      typeof expense.amount === "number"
        ? expense.amount
        : Number(expense.amount);

    if (!expense.splits.length) {
      // Reparto equitativo entre todos si no hay splits
      const share = amount / members.length;
      for (const m of members) {
        net[m.userId] = (net[m.userId] ?? 0) - share;
      }
      net[expense.paidById] = (net[expense.paidById] ?? 0) + amount;
      continue;
    }

    for (const split of expense.splits) {
      const pct =
        typeof split.percent === "number"
          ? split.percent
          : Number(split.percent);
      const owed = (amount * pct) / 100;
      net[split.userId] = (net[split.userId] ?? 0) - owed;
    }
    net[expense.paidById] = (net[expense.paidById] ?? 0) + amount;
  }

  // Simplificar a deudas mínimas (greedy)
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, value] of Object.entries(net)) {
    const rounded = Math.round(value * 100) / 100;
    if (rounded > 0.01) creditors.push({ id, amount: rounded });
    else if (rounded < -0.01) debtors.push({ id, amount: -rounded });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const nameOf = (id: string) =>
    members.find((m) => m.userId === id)?.name ?? "—";

  const edges: BalanceEdge[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    const rounded = Math.round(pay * 100) / 100;
    if (rounded > 0.01) {
      edges.push({
        fromId: debtors[i].id,
        fromName: nameOf(debtors[i].id),
        toId: creditors[j].id,
        toName: nameOf(creditors[j].id),
        amount: rounded,
      });
    }
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return edges;
}
