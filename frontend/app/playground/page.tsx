"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AgentRunner, type RunnerState } from "@/components/agent-runner";
import { explorerTx, formatUsdc, truncHex } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ServiceLite {
  id: string;
  name: string;
  endpoint: string;
  pricePerCall: string;
  provider: string;
  totalCalls: string;
  successfulCalls: string;
}

interface Preset {
  label: string;
  emoji: string;
  serviceNameContains: string;
  method: string;
  params: Record<string, unknown>;
}

const PRESETS: Record<string, Preset> = {
  "weather-london": {
    label: "Weather in London",
    emoji: "🌧️",
    serviceNameContains: "weather",
    method: "get_current_weather",
    params: { city: "London", units: "metric" },
  },
  "weather-tokyo": {
    label: "Weather in Tokyo",
    emoji: "🗼",
    serviceNameContains: "weather",
    method: "get_current_weather",
    params: { city: "Tokyo", units: "metric" },
  },
  "price-btc": {
    label: "BTC + ETH price",
    emoji: "₿",
    serviceNameContains: "coingecko",
    method: "get_price",
    params: { ids: "bitcoin,ethereum", vs_currencies: "usd" },
  },
};
const PRESET_LIST = Object.values(PRESETS);

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
  const search = useSearchParams();
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [method, setMethod] = useState<string>("get_current_weather");
  const [paramsText, setParamsText] = useState<string>(
    JSON.stringify({ city: "London", units: "metric" }, null, 2),
  );
  const [running, setRunning] = useState(false);
  const [runnerState, setRunnerState] = useState<RunnerState>({ kind: "idle" });
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    fetch("/api/playground/services")
      .then((r) => r.json())
      .then((d) => {
        const list: ServiceLite[] = d.services ?? [];
        setServices(list);

        // Honor ?preset=... or ?service=... from the URL once services land.
        const presetKey = search.get("preset");
        const serviceParam = search.get("service");
        const preset = presetKey ? PRESETS[presetKey] : undefined;

        if (preset) {
          const svc = list.find((s) =>
            s.name.toLowerCase().includes(preset.serviceNameContains.toLowerCase()),
          );
          if (svc) setServiceId(svc.id);
          else if (list[0]) setServiceId(list[0].id);
          setMethod(preset.method);
          setParamsText(JSON.stringify(preset.params, null, 2));
        } else if (serviceParam && list.some((s) => s.id === serviceParam)) {
          setServiceId(serviceParam);
        } else if (list[0]) {
          setServiceId(list[0].id);
        }
      })
      .catch(() => {});
  }, [search]);

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
    toast.success("Preset loaded", { description: p.label });
  }

  async function run() {
    setRunning(true);
    setResult(null);
    setRunnerState({ kind: "running", stepIndex: 0 });

    // Drive the visual runner forward as fake checkpoints during the real
    // network call. The real timeline comes back in the response.
    const ticker = setInterval(() => {
      setRunnerState((s) =>
        s.kind === "running" && s.stepIndex < 3
          ? { kind: "running", stepIndex: s.stepIndex + 1 }
          : s,
      );
    }, 700);

    try {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = paramsText.trim() ? JSON.parse(paramsText) : {};
      } catch {
        toast.error("Params is not valid JSON");
        setResult({ ok: false, error: "Params is not valid JSON" });
        setRunnerState({ kind: "done", success: false });
        setRunning(false);
        clearInterval(ticker);
        return;
      }
      toast.message("Agent dispatched", {
        description: `${selected?.name ?? "service"} · ${method}`,
      });
      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, method, params: parsed }),
      });
      const data = (await res.json()) as RunResult;
      setResult(data);
      setRunnerState({
        kind: "done",
        success: !!data.ok && data.result?.success !== false,
      });
      if (data.ok) {
        toast.success("Settled on-chain", {
          description: data.amountMicroUsdc
            ? `paid $${formatUsdc(BigInt(data.amountMicroUsdc))} USDC`
            : undefined,
        });
      } else {
        toast.error("Call failed", { description: data.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, error: msg });
      setRunnerState({ kind: "done", success: false });
      toast.error("Network error", { description: msg });
    } finally {
      clearInterval(ticker);
      setRunning(false);
    }
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <Badge variant="outline" className="gap-1.5">
          <Sparkles className="h-3 w-3 text-brand" />
          Live demo
        </Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Watch an agent pay,{" "}
          <span className="text-gradient">live on-chain.</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Press run. A server-side agent picks a provider, hits a 402, signs an
          EIP-3009 USDC authorization, settles on Kite testnet, splits 95/5, and
          logs an attestation. No wallet needed on your end.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Controls ──────────────────────────────────────────── */}
        <div className="surface-strong space-y-5 p-6 lg:col-span-2">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Quick presets
            </Label>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {PRESET_LIST.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-sm transition hover:border-brand/30 hover:bg-brand/[0.04]"
                >
                  <span className="text-base">{p.emoji}</span>
                  <span className="flex-1">{p.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-brand">
                    {p.method}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Service
            </Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Loading services…" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — ${formatUsdc(BigInt(s.pricePerCall))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="font-mono text-[10px]">
                  ${formatUsdc(BigInt(selected.pricePerCall))} / call
                </Badge>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {selected.successfulCalls}/{selected.totalCalls} calls
                </Badge>
              </div>
            )}
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Method
            </Label>
            <Input
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-2 font-mono text-sm"
              placeholder="get_current_weather"
            />
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Params (JSON)
            </Label>
            <Textarea
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
              rows={6}
              className="mt-2 resize-none font-mono text-xs"
            />
          </div>

          <Button
            onClick={run}
            disabled={running || !serviceId}
            size="lg"
            className="w-full"
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Agent working…
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Run as agent
              </>
            )}
          </Button>
        </div>

        {/* ── Runner + result ──────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-3">
          <AgentRunner state={runnerState} />

          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <ResultPanel result={result} />
              </motion.div>
            ) : (
              !running && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-10 text-center text-sm text-muted-foreground"
                >
                  Pick a preset, hit{" "}
                  <span className="font-mono text-foreground">Run as agent</span>
                  , and watch a real on-chain payment + provider call.
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({ result }: { result: RunResult }) {
  if (!result.ok) {
    return (
      <div className="surface space-y-3 p-6">
        <Badge variant="destructive">failed</Badge>
        <pre className="overflow-x-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
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
    <div className="surface space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        {success ? (
          <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25">
            success
          </Badge>
        ) : (
          <Badge variant="destructive">provider error</Badge>
        )}
        <Badge variant="secondary" className="font-mono">
          paid {amount}
        </Badge>
        {result.agent && (
          <Badge variant="secondary" className="font-mono">
            agent {truncHex(result.agent, 4, 4)}
          </Badge>
        )}
        {r?.latency_ms !== undefined && (
          <Badge variant="secondary" className="font-mono">
            {r.latency_ms}ms
          </Badge>
        )}
      </div>

      {(settleTx || attestTx) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {settleTx && <TxCard label="Settlement" hash={settleTx} />}
          {attestTx && <TxCard label="Attestation" hash={attestTx} />}
        </div>
      )}

      <Tabs defaultValue="response">
        <TabsList>
          <TabsTrigger value="response">Response</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="response" className="mt-3">
          <CodeBlock
            code={JSON.stringify(r?.data ?? r?.error ?? r, null, 2)}
          />
        </TabsContent>
        <TabsContent value="timeline" className="mt-3">
          {result.timeline ? (
            <Timeline steps={result.timeline} />
          ) : (
            <p className="text-xs text-muted-foreground">
              no timeline captured
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-1.5 text-xs">
      {steps.map((s, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded border border-white/[0.04] bg-white/[0.02] px-3 py-1.5"
        >
          <span className="w-14 shrink-0 text-right font-mono text-muted-foreground">
            +{s.ms}ms
          </span>
          <span className="font-medium">{s.label}</span>
          {s.detail && (
            <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
              {s.detail}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function TxCard({ label, hash }: { label: string; hash: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    toast.success(`${label} hash copied`);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <a
          href={explorerTx(hash)}
          target="_blank"
          rel="noreferrer"
          className="truncate font-mono text-xs text-brand hover:underline"
        >
          {truncHex(hash, 10, 8)}
        </a>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={copy}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <a
            href={explorerTx(hash)}
            target="_blank"
            rel="noreferrer"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className={cn(
          "absolute right-2 top-2 z-10 rounded-md border border-white/[0.06] bg-background/80 p-1.5 backdrop-blur transition",
          "text-muted-foreground hover:text-foreground",
        )}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <pre className="max-h-80 overflow-auto rounded-xl border border-white/[0.06] bg-black/40 p-4 font-mono text-[11px] leading-relaxed">
        {code}
      </pre>
    </div>
  );
}
