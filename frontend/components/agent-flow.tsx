"use client";

import { motion } from "framer-motion";
import { Bot, Server, Coins, ShieldCheck } from "lucide-react";

const NODES = [
  { id: "agent", label: "AI Agent", icon: Bot, x: 8, y: 50, color: "#34e1ff" },
  {
    id: "gateway",
    label: "Gateway",
    icon: Server,
    x: 38,
    y: 20,
    color: "#7c5cff",
  },
  {
    id: "facilitator",
    label: "x402 Facilitator",
    icon: Coins,
    x: 62,
    y: 80,
    color: "#ff5cd1",
  },
  {
    id: "registry",
    label: "On-chain",
    icon: ShieldCheck,
    x: 92,
    y: 50,
    color: "#34e1ff",
  },
] as const;

const EDGES = [
  { from: "agent", to: "gateway", label: "1. POST call" },
  { from: "gateway", to: "agent", label: "2. HTTP 402" },
  { from: "agent", to: "facilitator", label: "3. EIP-3009 sign" },
  { from: "facilitator", to: "registry", label: "4. Settle + attest" },
] as const;

export function AgentFlow() {
  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4 backdrop-blur-xl">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34e1ff" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#34e1ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        {EDGES.map((e, i) => {
          const from = NODES.find((n) => n.id === e.from)!;
          const to = NODES.find((n) => n.id === e.to)!;
          const path = `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${
            Math.min(from.y, to.y) - 15
          } ${to.x} ${to.y}`;
          return (
            <g key={i}>
              <path
                d={path}
                fill="none"
                stroke="url(#edgeGrad)"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
              <motion.circle
                r="0.8"
                fill="#34e1ff"
                initial={{ offsetDistance: "0%" }}
                animate={{ offsetDistance: "100%" }}
                transition={{
                  duration: 3,
                  delay: i * 0.7,
                  repeat: Infinity,
                  repeatDelay: NODES.length * 0.7,
                  ease: "easeInOut",
                }}
                style={{
                  offsetPath: `path("${path}")`,
                  filter: "drop-shadow(0 0 4px #34e1ff)",
                }}
              />
            </g>
          );
        })}
      </svg>

      {NODES.map((n, i) => (
        <motion.div
          key={n.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.15, duration: 0.5 }}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
        >
          <div className="relative flex flex-col items-center gap-2">
            <div
              className="absolute inset-0 rounded-2xl blur-xl"
              style={{ backgroundColor: n.color, opacity: 0.25 }}
            />
            <div
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl border bg-background/80 backdrop-blur"
              style={{ borderColor: `${n.color}40` }}
            >
              <n.icon className="h-5 w-5" style={{ color: n.color }} />
            </div>
            <div className="whitespace-nowrap rounded-full border border-white/10 bg-background/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
              {n.label}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
