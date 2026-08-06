"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export function CategoryChart({
  data,
}: {
  data: { name: string; total: number; color: string }[];
}) {
  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-stone-400">
        Sin gastos este mes
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#78716c" }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={48}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#78716c" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}€`}
            width={40}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0))}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e7e5e4",
              fontSize: 13,
            }}
          />
          <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#08a080" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
