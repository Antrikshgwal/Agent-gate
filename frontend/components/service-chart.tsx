"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

interface Props {
  successful: number;
  failed: number;
}

export function ServiceChart({ successful, failed }: Props) {
  if (successful + failed === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        no calls yet
      </div>
    );
  }

  const data = [
    { name: "successful", value: successful, color: "#34d399" },
    { name: "failed", value: failed, color: "#f87171" },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "rgba(15, 15, 18, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            itemStyle={{ color: "#f4f4f5" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
