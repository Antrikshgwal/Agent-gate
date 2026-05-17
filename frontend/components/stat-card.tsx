"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  delay?: number;
  accent?: "brand" | "violet" | "pink";
  className?: string;
}

const ACCENT = {
  brand: "from-brand/30 via-brand/0 to-brand/0",
  violet: "from-brand-violet/30 via-brand-violet/0 to-brand-violet/0",
  pink: "from-brand-pink/30 via-brand-pink/0 to-brand-pink/0",
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  delay = 0,
  accent = "brand",
  className,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-radial opacity-50 blur-2xl transition group-hover:opacity-80",
          "bg-gradient-to-br",
          ACCENT[accent],
        )}
      />
      <div className="relative flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="relative mt-4 font-display text-4xl font-semibold tracking-tight">
        {value}
      </div>
      {sub && (
        <div className="relative mt-1.5 text-xs text-muted-foreground">
          {sub}
        </div>
      )}
    </motion.div>
  );
}
