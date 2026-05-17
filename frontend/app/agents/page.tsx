/// /agents — human-readable mirror of /.well-known/agent.json.

import Link from "next/link";
import { headers } from "next/headers";
import {
  Bot,
  Sparkles,
  Network,
  FileCode2,
  Boxes,
  Coins,
  Workflow,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CopyInline } from "@/components/copy-inline";
import { CodeBlockCopyable } from "@/components/code-block";
import { buildManifest } from "@/lib/agent-manifest";
import { formatUsdc, truncHex } from "@/lib/format";

export const revalidate = 30;

export default async function AgentsPage() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;
  const manifest = await buildManifest(origin);

  return (
    <div className="space-y-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(manifest) }}
      />

      <header className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-brand/10 via-brand-violet/10 to-transparent p-10">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-brand-violet/15 blur-3xl" />
        <div className="relative">
          <Badge variant="outline" className="gap-1.5">
            <Bot className="h-3 w-3 text-brand" />
            Agent launchpad
          </Badge>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Hello, autonomous agent.
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            You scraped your way here. Everything you need to use AgentGate —
            without any human in the loop — is on this page. Machine-readable
            copies are at the URLs below.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/.well-known/agent.json"
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5 font-mono text-xs text-brand hover:bg-brand/20"
            >
              GET /.well-known/agent.json
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/agents.txt"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              GET /agents.txt
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      <Section icon={Sparkles} title="What this is">
        <p className="text-muted-foreground">{manifest.description}</p>
      </Section>

      <Section icon={Workflow} title="Onboarding · 4 steps, no humans">
        <ol className="space-y-3">
          {manifest.onboarding.map((s) => (
            <li
              key={s.step}
              className="surface flex gap-4 p-4 transition hover:border-brand/30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 font-mono text-sm font-semibold text-brand">
                {s.step}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{s.action}</div>
                {s.detail && (
                  <div className="mt-1 break-words font-mono text-xs text-muted-foreground">
                    {s.detail}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section icon={Network} title="Network">
        <div className="surface p-6">
          <Kv k="Chain" v={`${manifest.chain.name} (id ${manifest.chain.id})`} />
          <Kv k="RPC" v={manifest.chain.rpc} copy />
          <Kv k="Explorer" v={manifest.chain.explorer} copy />
          <Kv
            k="Payment asset"
            v={`${manifest.asset.symbol} @ ${manifest.asset.address}`}
            copyValue={manifest.asset.address}
          />
          <Kv
            k="Protocol"
            v={`${manifest.protocol.name} v${manifest.protocol.version}`}
          />
          <Kv
            k="Gateway"
            v={`${manifest.gateway.url}${manifest.gateway.call_path}`}
            copyValue={`${manifest.gateway.url}${manifest.gateway.call_path}`}
          />
        </div>
      </Section>

      <Section icon={FileCode2} title="Smart contracts">
        <div className="surface p-6">
          <Kv k="ServiceRegistry" v={manifest.contracts.service_registry} copy />
          <Kv k="AgentRegistry" v={manifest.contracts.agent_registry} copy />
          <Kv k="PaymentSplitter" v={manifest.contracts.payment_splitter} copy />
          <Kv
            k="AttestationLogger"
            v={manifest.contracts.attestation_logger}
            copy
          />
          <Kv
            k="Revenue split"
            v={`${manifest.revenue_split.provider_bps / 100}% provider · ${manifest.revenue_split.protocol_bps / 100}% protocol`}
          />
        </div>
      </Section>

      <Section
        icon={Boxes}
        title={`Services · ${manifest.services.length} live`}
      >
        <div className="space-y-4">
          {manifest.services.map((s) => (
            <div key={s.id} className="surface-strong p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="font-display text-xl font-semibold tracking-tight">
                    {s.name}
                  </div>
                  <CopyInline value={s.id} display={truncHex(s.id, 10, 6)} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-mono">
                    ${formatUsdc(BigInt(s.price_micro_usdc))} / call
                  </Badge>
                  <Badge variant="secondary" className="font-mono">
                    {s.successful_calls}/{s.total_calls}
                  </Badge>
                  <Badge variant="secondary" className="font-mono">
                    {(s.uptime_bps / 100).toFixed(1)}% up
                  </Badge>
                </div>
              </div>

              {s.methods.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {s.methods.map((m) => (
                    <div
                      key={m.name}
                      className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4"
                    >
                      <div className="font-mono text-sm text-brand">
                        {m.name}
                      </div>
                      {m.description && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {m.description}
                        </div>
                      )}
                      <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                        Params
                      </div>
                      <ul className="mt-1.5 space-y-0.5 font-mono text-[11px]">
                        {Object.entries(m.params).map(([k, v]) => (
                          <li key={k} className="flex gap-2">
                            <span className="text-brand">{k}</span>
                            <span className="text-muted-foreground">— {v}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                        Example
                      </div>
                      <CodeBlockCopyable
                        code={JSON.stringify(m.example, null, 2)}
                        small
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  No published method schema. Inspect the endpoint or ask the
                  provider.
                </p>
              )}

              {s.example_curl && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Raw curl example
                  </summary>
                  <div className="mt-2">
                    <CodeBlockCopyable code={s.example_curl} small />
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Coins} title="SDK · TypeScript">
        <div className="surface p-6">
          <p className="text-sm text-muted-foreground">
            One method wraps the entire x402 flow.
          </p>
          <div className="mt-3">
            <CodeBlockCopyable
              code={`npm install ${manifest.sdk.typescript.npm} ethers

import { AgentGateClient, findProvider } from "${manifest.sdk.typescript.npm}";

const provider = await findProvider({
  rpcUrl: "${manifest.chain.rpc}",
  serviceRegistry: "${manifest.contracts.service_registry}",
  name: "OpenWeather",
  strategy: "cheapest",
});

const client = new AgentGateClient({
  gatewayUrl: "${manifest.gateway.url}",
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  rpcUrl: "${manifest.chain.rpc}",
  agentDID: process.env.AGENT_DID!,
});

const r = await client.call({
  serviceId: provider.id,
  method: "get_current_weather",
  params: { city: "London", units: "metric" },
});
console.log(r.data);`}
            />
          </div>
        </div>
      </Section>

      <Separator />
      <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Manifest generated {manifest.generated_at}</span>
        <div className="flex gap-4">
          <Link
            href="/services"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            /services <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="/playground"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            /playground <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="inline-flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
        <Icon className="h-4 w-4 text-brand" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Kv({
  k,
  v,
  copy,
  copyValue,
}: {
  k: string;
  v: string;
  copy?: boolean;
  copyValue?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/[0.04] py-2.5 last:border-0">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {k}
      </span>
      <span className="break-all">
        {copy || copyValue ? (
          <CopyInline value={copyValue ?? v} display={v} />
        ) : (
          <span className="text-sm">{v}</span>
        )}
      </span>
    </div>
  );
}
