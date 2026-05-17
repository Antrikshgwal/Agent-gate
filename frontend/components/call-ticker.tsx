"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Item {
  service: string;
  amount: string;
  agent: string;
}

export function CallTicker({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-muted-foreground">
        no calls yet — be the first to{" "}
        <a href="/playground" className="text-brand hover:underline">
          run one
        </a>
      </div>
    );
  }

  const loop = [...items, ...items];

  return (
    <div className="marquee-mask overflow-hidden">
      <motion.div
        className="flex w-max gap-3"
        animate={{ x: ["0%", "-50%"] }}
        transition={{
          duration: 40,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {loop.map((item, i) => (
          <div
            key={i}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-xs backdrop-blur",
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-mono text-muted-foreground">
              {item.agent}
            </span>
            <span className="text-muted-foreground">paid</span>
            <span className="font-mono font-medium text-foreground">
              ${item.amount}
            </span>
            <span className="text-muted-foreground">to</span>
            <span className="font-medium text-brand">{item.service}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
