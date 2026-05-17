"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bot, Server, Coins, ShieldCheck, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "discover", label: "Discover provider", icon: Server },
  { id: "quote", label: "Negotiate 402", icon: Coins },
  { id: "sign", label: "Sign EIP-3009", icon: Bot },
  { id: "settle", label: "Settle on-chain", icon: ShieldCheck },
  { id: "attest", label: "Attest + return", icon: Check },
] as const;

export type RunnerState =
  | { kind: "idle" }
  | { kind: "running"; stepIndex: number }
  | { kind: "done"; success: boolean };

export function AgentRunner({ state }: { state: RunnerState }) {
  const activeIdx =
    state.kind === "running"
      ? state.stepIndex
      : state.kind === "done"
        ? STEPS.length
        : -1;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-6">
      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-brand-violet/10 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-background/80 backdrop-blur">
          <motion.div
            className="absolute inset-0 rounded-2xl"
            animate={
              state.kind === "running"
                ? { boxShadow: ["0 0 0 0 rgba(52,225,255,0.4)", "0 0 0 12px rgba(52,225,255,0)"] }
                : { boxShadow: "0 0 0 0 rgba(52,225,255,0)" }
            }
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <Bot className="h-6 w-6 text-brand" />
        </div>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Demo agent
          </div>
          <div className="text-sm font-medium">
            <AnimatePresence mode="wait">
              <motion.span
                key={state.kind === "running" ? state.stepIndex : state.kind}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {state.kind === "idle" && "Ready"}
                {state.kind === "running" && STEPS[state.stepIndex]?.label}
                {state.kind === "done" &&
                  (state.success ? "Done" : "Failed")}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        {state.kind === "running" && (
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
        )}
      </div>

      <ol className="relative mt-6 space-y-2.5">
        {STEPS.map((s, i) => {
          const done = activeIdx > i;
          const active = activeIdx === i;
          const pending = activeIdx < i;
          return (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 transition-all",
                done && "border-emerald-500/20 bg-emerald-500/[0.04]",
                active && "border-brand/30 bg-brand/[0.05]",
                pending && "border-white/[0.04] bg-white/[0.01] opacity-60",
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md text-xs",
                  done && "bg-emerald-500/15 text-emerald-400",
                  active && "bg-brand/15 text-brand",
                  pending && "bg-white/[0.04] text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <s.icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={cn(
                  "text-sm",
                  done && "text-foreground",
                  active && "text-foreground",
                  pending && "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                step {(i + 1).toString().padStart(2, "0")}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const RUNNER_STEPS = STEPS;
