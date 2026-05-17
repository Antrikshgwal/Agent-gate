"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { explorerTx, formatUsdc, truncHex } from "@/lib/format";

interface ServiceLite {
  id: string;
  name: string;
  endpoint: string;
  pricePerCall: string; // stringified bigint
  provider: string;
  totalCalls: string;
  successfulCalls: string;
}

interface Preset {
  label: string;
  serviceNameContains: string;
  method: string;
  params: Record<string, unknown>;
}

const PRESETS: Preset[] = [
  {
    label: "Weather in London (metric)",
    serviceNameContains: "weather",
    method: "get_current_weather",
    params: { city: "London", units: "metric" },
  },
  {
    label: "Weather in Tokyo (metric)",
    serviceNameContains: "weather",
    method: "get_current_weather",
    params: { city: "Tokyo", units: "metric" },
  },
  {
    label: "BTC + ETH price in USD",
    serviceNameContains: "coingecko",
    method: "get_price",
    params: { ids: "bitcoin,ethereum", vs_currencies: "usd" },
  },
];

interface TimelineStep {
  label: string;
  ms: number;
  detail?: string;
}

interface RunResult {
  ok: boolean;
  agent?: string;
  amountMicroUsdc?: string;
  payTo?: string;
  result?: {
    success?: boolean;
    data?: unknown;
    error?: string;
    payment?: {
      transaction: string;
      attestation_tx_hash: string | null;
      amount: string;
    };
    latency_ms?: number;
  };
  timeline?: TimelineStep[];
  error?: string;
}

export default function PlaygroundPage() {
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [method, setMethod] = useState<string>("get_current_weather");
  const [paramsText, setParamsText] = useState<string>(
    JSON.stringify({ city: "London", units: "metric" }, null, 2),
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    fetch("/api/playground/services")
      .then((r) => r.json())
      .then((d) => {
        setServices(d.services ?? []);
        if (d.services?.[0]) setServiceId(d.services[0].id);
      })
      .catch(() => {});
  }, []);

  const selected = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  function applyPreset(p: Preset) {
    const svc = services.find((s) =>
      s.name.toLowerCase().includes(p.serviceNameContains.toLowerCase()),
    );
    if (svc) setServiceId(svc.id);
    setMethod(p.method);
    setParamsText(JSON.stringify(p.params, null, 2));
  }

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = paramsText.trim() ? JSON.parse(paramsText) : {};
      } catch {
        setResult({ ok: false, error: "Params is not valid JSON" });
        setRunning(false);
        return;
      }
      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, method, params: parsed }),
      });
      const data = (await res.json()) as RunResult;
      setResult(data);
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-wider text-ink-dim">
          Agent Playground
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Run a paid call as an autonomous agent
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          The button below tells a server-side agent (with its own wallet) to
          call a registered service over x402. It signs an EIP-3009 USDC
          authorization, the gateway settles it on Kite testnet, splits the
          payment 95/5, forwards the request to the provider, and logs an
          on-chain attestation — all in one click.
        </p>
      </header>

      <Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label>Quick presets</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className="rounded-full border border-line bg-bg px-3 py-1 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Service</Label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
              >
                {services.length === 0 && <option>Loading…</option>}
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — ${formatUsdc(BigInt(s.pricePerCall))} ·{" "}
                    {truncHex(s.id, 6, 4)}
                  </option>
                ))}
              </select>
              {selected && (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink-dim">
                  <Badge variant="muted">
                    ${formatUsdc(BigInt(selected.pricePerCall))} per call
                  </Badge>
                  <Badge variant="muted">
                    {selected.successfulCalls}/{selected.totalCalls} calls
                  </Badge>
                  <Badge variant="muted">
                    provider {truncHex(selected.provider, 6, 4)}
                  </Badge>
                </div>
              )}
            </div>

            <div>
              <Label>Method</Label>
              <input
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-sm"
                placeholder="get_current_weather"
              />
            </div>

            <div>
              <Label>Params (JSON)</Label>
              <textarea
                value={paramsText}
                onChange={(e) => setParamsText(e.target.value)}
                rows={6}
                className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs"
              />
            </div>

            <button
              onClick={run}
              disabled={running || !serviceId}
              className={cn(
                "w-full rounded-lg border px-4 py-3 text-sm font-semibold transition-colors",
                running || !serviceId
                  ? "cursor-not-allowed border-line bg-bg-2 text-ink-dim"
                  : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20",
              )}
            >
              {running ? "Agent is paying & calling…" : "Run as agent"}
            </button>
          </div>

          <div className="rounded-lg border border-line bg-bg p-4">
            <Label>Result</Label>
            {!result && !running && (
              <p className="mt-3 text-sm text-ink-dim">
                Press <span className="font-mono">Run as agent</span> to fire a
                real paid call against the gateway and the provider.
              </p>
            )}
            {running && (
              <p className="mt-3 text-sm text-ink-muted">
                Quoting → signing → settling on-chain…
              </p>
            )}
            {result && <ResultPanel result={result} />}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-ink-dim">
      {children}
    </div>
  );
}

function ResultPanel({ result }: { result: RunResult }) {
  if (!result.ok) {
    return (
      <div className="mt-3 space-y-2">
        <Badge variant="bad">failed</Badge>
        <pre className="overflow-x-auto rounded bg-bg-2 p-3 text-xs text-bad">
          {result.error ?? "unknown error"}
        </pre>
        {result.timeline && <Timeline steps={result.timeline} />}
      </div>
    );
  }

  const r = result.result;
  const success = r?.success !== false;
  const settleTx = r?.payment?.transaction;
  const attestTx = r?.payment?.attestation_tx_hash ?? undefined;
  const amount = result.amountMicroUsdc
    ? `$${formatUsdc(BigInt(result.amountMicroUsdc))}`
    : "—";

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {success ? (
          <Badge variant="success">success</Badge>
        ) : (
          <Badge variant="bad">provider returned error</Badge>
        )}
        <Badge variant="muted">paid {amount}</Badge>
        {result.agent && (
          <Badge variant="muted">agent {truncHex(result.agent, 6, 4)}</Badge>
        )}
      </div>

      {(settleTx || attestTx) && (
        <div className="space-y-1 text-xs">
          {settleTx && <TxRow label="Settlement" hash={settleTx} />}
          {attestTx && <TxRow label="Attestation" hash={attestTx} />}
        </div>
      )}

      {result.timeline && <Timeline steps={result.timeline} />}

      <div>
        <Label>Provider response</Label>
        <pre className="mt-2 max-h-72 overflow-auto rounded bg-bg-2 p-3 text-[11px]">
          {JSON.stringify(r?.data ?? r?.error ?? r, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div>
      <Label>Timeline</Label>
      <ol className="mt-2 space-y-1 text-xs">
        {steps.map((s, i) => (
          <li key={i} className="flex items-baseline gap-3">
            <span className="w-12 shrink-0 text-right font-mono text-ink-dim">
              {s.ms}ms
            </span>
            <span className="text-ink">{s.label}</span>
            {s.detail && (
              <span className="truncate font-mono text-[10px] text-ink-dim">
                {s.detail}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function TxRow({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-line bg-bg-2 px-2 py-1.5">
      <span className="text-ink-dim">{label}</span>
      <a
        href={explorerTx(hash)}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-accent hover:underline"
      >
        {truncHex(hash, 8, 6)} ↗
      </a>
    </div>
  );
}
