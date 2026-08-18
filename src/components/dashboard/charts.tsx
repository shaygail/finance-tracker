"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "#059669",
  "#0d9488",
  "#0891b2",
  "#0284c7",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#f43f5e",
];

interface ExpenseChartProps {
  data: Array<{ name: string; value: number }>;
}

export function ExpensePieChart({ data }: ExpenseChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">No expense data</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) =>
            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, "Amount"]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface RevenueChartProps {
  data: Array<{ name: string; revenue: number }>;
}

export function RevenueBarChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">No product data</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]} />
        <Legend />
        <Bar dataKey="revenue" fill="#059669" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface PaymentMethodChartProps {
  data: Array<{ name: string; revenue: number; orders: number }>;
}

export function PaymentMethodPieChart({ data }: PaymentMethodChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">No payment data</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={100}
          paddingAngle={2}
          dataKey="revenue"
          nameKey="name"
          label={({ name, percent }) =>
            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _name, item) => {
            const orders = (item?.payload as { orders?: number })?.orders;
            return [
              `$${Number(value).toFixed(2)}${orders != null ? ` · ${orders} orders` : ""}`,
              "Revenue",
            ];
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PaymentMethodBarChart({ data }: PaymentMethodChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">No payment data</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
        />
        <Bar dataKey="revenue" fill="#0d9488" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
