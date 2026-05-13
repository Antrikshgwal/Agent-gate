"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseUnits, type Address } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HashLink } from "@/components/ui/hash";
import { serviceRegistry, usdc } from "@/lib/contracts";
import { env } from "@/lib/env";
import { explorerTx, formatUsdc, truncHex } from "@/lib/format";

interface FormState {
  name: string;
  endpoint: string;
  price: string; // USDC, decimal
  stake: string; // USDC, decimal
  maxLatencyMs: string;
  minUptimePct: string; // 0–100
  penaltyPerViolation: string; // USDC, decimal
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
  const [step, setStep] = useState<"idle" | "approving" | "registering" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [approveHash, setApproveHash] = useState<`0x${string}` | null>(null);
  const [registerHash, setRegisterHash] = useState<`0x${string}` | null>(null);

  // Read MIN_STAKE so we can show it inline and validate.
  const { data: minStake } = useReadContract({
    ...serviceRegistry,
    functionName: "MIN_STAKE",
  });
  // Read user's USDC balance + current allowance to the registry.
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

    if (!address) {
      setErrorMsg("Connect a wallet first.");
      return;
    }

    let priceWei: bigint;
    let stakeWei: bigint;
    let penaltyWei: bigint;
    try {
      priceWei = parseUnits(form.price, 6);
      stakeWei = parseUnits(form.stake, 6);
      penaltyWei = parseUnits(form.penaltyPerViolation, 6);
    } catch {
      setErrorMsg("Price/stake/penalty must be valid decimal numbers.");
      return;
    }

    if (minStake !== undefined && stakeWei < (minStake as bigint)) {
      setErrorMsg(
        `Stake must be at least $${formatUsdc(minStake as bigint)} USDC.`,
      );
      return;
    }
    if (balance !== undefined && (balance as bigint) < stakeWei) {
      setErrorMsg(
        `Your wallet only holds $${formatUsdc(balance as bigint)} USDC; you need $${form.stake}.`,
      );
      return;
    }

    const minUptimeBps = Math.round(Number(form.minUptimePct) * 100);
    const sla = {
      maxLatencyMs: BigInt(form.maxLatencyMs),
      minUptimePercent: BigInt(minUptimeBps),
      penaltyPerViolation: penaltyWei,
    } as const;

    try {
      // Step 1: approve if allowance is short.
      const needAllowance = (allowance as bigint | undefined) ?? 0n;
      if (needAllowance < stakeWei) {
        setStep("approving");
        const tx = await writeContractAsync({
          ...usdc,
          functionName: "approve",
          args: [serviceRegistry.address, stakeWei],
        });
        setApproveHash(tx);
      }

      // Step 2: registerService.
      setStep("registering");
      const tx = await writeContractAsync({
        ...serviceRegistry,
        functionName: "registerService",
        args: [
          form.name,
          form.endpoint,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          priceWei,
          stakeWei,
          [sla.maxLatencyMs, sla.minUptimePercent, sla.penaltyPerViolation] as unknown as {
            maxLatencyMs: bigint;
            minUptimePercent: bigint;
            penaltyPerViolation: bigint;
          },
        ],
      });
      setRegisterHash(tx);
      setStep("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep("idle");
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-wider text-ink-dim">Service registration</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">List your service on AgentGate</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Stake USDC on-chain, set your price, and your service becomes
          discoverable to every AgentGate agent. The stake is at risk of slashing
          if the SLA is violated.
        </p>
      </header>

      {!isConnected ? (
        <Card>
          <CardHeader>Connect a wallet to continue</CardHeader>
          <p className="mb-4 text-sm text-ink-muted">
            Registration is an on-chain transaction (USDC approve + registerService).
            Connect a Kite-funded wallet to proceed.
          </p>
          <ConnectButton />
        </Card>
      ) : (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader>Service</CardHeader>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Name"
                hint="Must match a gateway-registered adapter exactly, e.g. 'OpenWeather'."
              >
                <input
                  required
                  className="input"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="OpenWeather"
                />
              </Field>
              <Field label="Endpoint URL" hint="Base URL the gateway forwards to.">
                <input
                  required
                  className="input"
                  type="url"
                  value={form.endpoint}
                  onChange={(e) => set("endpoint", e.target.value)}
                  placeholder="https://api.openweathermap.org"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader>Pricing</CardHeader>
            <div className="space-y-4">
              <Field label="Price per call (USDC)" hint="Charged to the agent per call.">
                <input
                  required
                  className="input"
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
                    ? `Minimum: $${formatUsdc(minStake as bigint)}.`
                    : "Loading min stake…"
                }
              >
                <input
                  required
                  className="input"
                  type="number"
                  step="1"
                  min="100"
                  value={form.stake}
                  onChange={(e) => set("stake", e.target.value)}
                />
              </Field>
              {balance !== undefined && (
                <div className="text-xs text-ink-dim">
                  Wallet balance: ${formatUsdc(balance as bigint)} USDC
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>SLA</CardHeader>
            <div className="space-y-4">
              <Field label="Max latency (ms)">
                <input
                  required
                  className="input"
                  type="number"
                  min="1"
                  value={form.maxLatencyMs}
                  onChange={(e) => set("maxLatencyMs", e.target.value)}
                />
              </Field>
              <Field label="Min uptime (%)" hint="e.g. 99.9 — stored as basis points × 100 on chain.">
                <input
                  required
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.minUptimePct}
                  onChange={(e) => set("minUptimePct", e.target.value)}
                />
              </Field>
              <Field label="Slash per violation (USDC)">
                <input
                  required
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.penaltyPerViolation}
                  onChange={(e) => set("penaltyPerViolation", e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="md:col-span-2">
            {errorMsg && (
              <div className="mb-4 rounded-md border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-ink-muted">
                Signed-in as <HashLink value={address!} kind="address" /> · chain{" "}
                {env.chainId}
              </div>
              <button
                type="submit"
                disabled={step === "approving" || step === "registering"}
                className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {step === "approving"
                  ? "Approving USDC…"
                  : step === "registering"
                    ? "Registering on-chain…"
                    : "Register service"}
              </button>
            </div>

            {(approveHash || registerHash) && (
              <div className="mt-4 space-y-2 text-xs text-ink-muted">
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
                {step === "done" && (
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="success">success</Badge>
                    <span>Service registered. It will appear in the directory shortly.</span>
                    <a
                      className="text-accent underline-offset-4 hover:underline"
                      href={registerHash ? explorerTx(registerHash) : "#"}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      View on Kitescan ↗
                    </a>
                  </div>
                )}
              </div>
            )}
          </Card>
        </form>
      )}

      <style>{`
        .input {
          width: 100%;
          background: #0a0a0b;
          border: 1px solid #1f1f23;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: #f4f4f5;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: rgba(52, 225, 255, 0.5);
          box-shadow: 0 0 0 3px rgba(52, 225, 255, 0.1);
        }
      `}</style>

      {/* Unused import guard for explorerTx in jsx context */}
      <noscript>{truncHex("0x0")}</noscript>
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
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-ink-dim">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-ink-dim">{hint}</p>}
    </label>
  );
}
