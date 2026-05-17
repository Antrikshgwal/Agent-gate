"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseUnits, type Address } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import {
  Sparkles,
  Wallet,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { HashLink } from "@/components/ui/hash";
import { serviceRegistry, usdc } from "@/lib/contracts";
import { env } from "@/lib/env";
import { explorerTx, formatUsdc } from "@/lib/format";

interface FormState {
  name: string;
  endpoint: string;
  price: string;
  stake: string;
  maxLatencyMs: string;
  minUptimePct: string;
  penaltyPerViolation: string;
}

const INITIAL: FormState = {
  name: "",
  endpoint: "",
  price: "0.01",
  stake: "100",
  maxLatencyMs: "500",
  minUptimePct: "99.9",
  penaltyPerViolation: "1",
};

export default function RegisterPage() {
  const { address, isConnected } = useAccount();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [step, setStep] = useState<"idle" | "approving" | "registering" | "done">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [approveHash, setApproveHash] = useState<`0x${string}` | null>(null);
  const [registerHash, setRegisterHash] = useState<`0x${string}` | null>(null);

  const { data: minStake } = useReadContract({
    ...serviceRegistry,
    functionName: "MIN_STAKE",
  });
  const { data: balance } = useReadContract({
    ...usdc,
    functionName: "balanceOf",
    args: address ? [address as Address] : undefined,
    query: { enabled: !!address },
  });
  const { data: allowance } = useReadContract({
    ...usdc,
    functionName: "allowance",
    args: address ? [address as Address, serviceRegistry.address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContractAsync } = useWriteContract();

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!address) return setErrorMsg("Connect a wallet first.");

    let priceWei: bigint;
    let stakeWei: bigint;
    let penaltyWei: bigint;
    try {
      priceWei = parseUnits(form.price, 6);
      stakeWei = parseUnits(form.stake, 6);
      penaltyWei = parseUnits(form.penaltyPerViolation, 6);
    } catch {
      return setErrorMsg("Price/stake/penalty must be valid decimals.");
    }

    if (minStake !== undefined && stakeWei < (minStake as bigint)) {
      return setErrorMsg(
        `Stake must be at least $${formatUsdc(minStake as bigint)} USDC.`,
      );
    }
    if (balance !== undefined && (balance as bigint) < stakeWei) {
      return setErrorMsg(
        `Wallet holds $${formatUsdc(balance as bigint)} USDC; need $${form.stake}.`,
      );
    }

    const minUptimeBps = Math.round(Number(form.minUptimePct) * 100);
    const sla = [
      BigInt(form.maxLatencyMs),
      BigInt(minUptimeBps),
      penaltyWei,
    ] as const;

    try {
      const needAllowance = (allowance as bigint | undefined) ?? 0n;
      if (needAllowance < stakeWei) {
        setStep("approving");
        toast.message("Approve USDC", {
          description: "Sign the allowance in your wallet",
        });
        const tx = await writeContractAsync({
          ...usdc,
          functionName: "approve",
          args: [serviceRegistry.address, stakeWei],
        });
        setApproveHash(tx);
        toast.success("Approval sent", { description: tx.slice(0, 10) + "…" });
      }

      setStep("registering");
      toast.message("Registering on-chain", {
        description: "Sign the registerService tx",
      });
      const tx = await writeContractAsync({
        ...serviceRegistry,
        functionName: "registerService",
        args: [
          form.name,
          form.endpoint,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          priceWei,
          stakeWei,
          sla as unknown as {
            maxLatencyMs: bigint;
            minUptimePercent: bigint;
            penaltyPerViolation: bigint;
          },
        ],
      });
      setRegisterHash(tx);
      setStep("done");
      toast.success("Service registered", { description: "Live in /services" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      toast.error("Failed", { description: msg });
      setStep("idle");
    }
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <Badge variant="outline" className="gap-1.5">
          <Sparkles className="h-3 w-3 text-brand" />
          Provider onboarding
        </Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
          List your service.{" "}
          <span className="text-gradient">Take 95% of every call.</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Stake USDC, set your price, and you&apos;re live. Stake is at risk if
          the SLA is violated — that&apos;s the reputation guarantee.
        </p>
      </header>

      {!isConnected ? (
        <div className="surface-strong relative overflow-hidden p-10">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand/15 blur-3xl" />
          <Wallet className="h-8 w-8 text-brand" />
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            Connect a wallet to register
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Registration is two on-chain transactions: USDC approve, then
            registerService. Use a wallet funded on Kite testnet.
          </p>
          <div className="mt-6">
            <ConnectButton />
          </div>
        </div>
      ) : step === "done" ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="surface-strong relative overflow-hidden p-12 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-brand/10" />
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15"
            >
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </motion.div>
            <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight">
              You&apos;re live.
            </h2>
            <p className="mt-2 text-muted-foreground">
              <span className="text-foreground">{form.name}</span> is now
              discoverable to every AgentGate agent.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <a href="/services">
                  View it in the directory
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
              {registerHash && (
                <Button asChild variant="outline">
                  <a
                    href={explorerTx(registerHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Tx on Kitescan
                    <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <FieldCard title="Service" subtitle="What are you reselling?">
              <Field
                label="Name"
                hint="Must match a gateway-registered adapter (e.g. 'OpenWeather')."
              >
                <Input
                  required
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="OpenWeather"
                />
              </Field>
              <Field label="Endpoint URL" hint="Base URL the gateway forwards to.">
                <Input
                  required
                  type="url"
                  value={form.endpoint}
                  onChange={(e) => set("endpoint", e.target.value)}
                  placeholder="https://api.openweathermap.org"
                />
              </Field>
            </FieldCard>

            <FieldCard title="Pricing" subtitle="What does a call cost?">
              <Field label="Price per call (USDC)">
                <Input
                  required
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                />
              </Field>
              <Field
                label="Reputation stake (USDC)"
                hint={
                  minStake !== undefined
                    ? `Minimum: $${formatUsdc(minStake as bigint)}`
                    : "Loading…"
                }
              >
                <Input
                  required
                  type="number"
                  step="1"
                  min="100"
                  value={form.stake}
                  onChange={(e) => set("stake", e.target.value)}
                />
              </Field>
              {balance !== undefined && (
                <div className="text-xs text-muted-foreground">
                  Wallet: ${formatUsdc(balance as bigint)} USDC
                </div>
              )}
            </FieldCard>
          </div>

          <FieldCard title="SLA" subtitle="What are you promising?">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Max latency (ms)">
                <Input
                  required
                  type="number"
                  min="1"
                  value={form.maxLatencyMs}
                  onChange={(e) => set("maxLatencyMs", e.target.value)}
                />
              </Field>
              <Field
                label="Min uptime (%)"
                hint="Stored as basis points × 100 on chain."
              >
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.minUptimePct}
                  onChange={(e) => set("minUptimePct", e.target.value)}
                />
              </Field>
              <Field label="Slash / violation (USDC)">
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.penaltyPerViolation}
                  onChange={(e) => set("penaltyPerViolation", e.target.value)}
                />
              </Field>
            </div>
          </FieldCard>

          {errorMsg && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{errorMsg}</p>
            </div>
          )}

          <div className="surface flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="text-xs text-muted-foreground">
              Signed in as <HashLink value={address!} kind="address" /> · chain{" "}
              {env.chainId}
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={step === "approving" || step === "registering"}
            >
              {step === "approving" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving…
                </>
              ) : step === "registering" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering…
                </>
              ) : (
                "Register service"
              )}
            </Button>
          </div>

          {(approveHash || registerHash) && (
            <div className="surface space-y-2 p-4 text-xs text-muted-foreground">
              {approveHash && (
                <div>
                  Approval tx: <HashLink value={approveHash} kind="tx" />
                </div>
              )}
              {registerHash && (
                <div>
                  Registration tx: <HashLink value={registerHash} kind="tx" />
                </div>
              )}
            </div>
          )}
        </form>
      )}

      <Separator />
      <p className="text-center text-xs text-muted-foreground">
        Need help? Read the{" "}
        <a href="/agents" className="text-brand hover:underline">
          agent manifest
        </a>{" "}
        for full contract details.
      </p>
    </div>
  );
}

function FieldCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-strong space-y-4 p-6">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
