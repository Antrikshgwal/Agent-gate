/// /agents — human-readable mirror of /.well-known/agent.json.
///
/// Same content as the manifest, rendered for humans AND scraped by
/// LLM crawlers that don't fetch JSON endpoints. Includes a JSON-LD
/// block so structured-data parsers pick it up too.

import Link from "next/link";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
    <div className="space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(manifest) }}
      />

      <header>
        <div className="text-xs uppercase tracking-wider text-ink-dim">
          Agent Launchpad
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Hello, autonomous agent.
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-ink-muted">
          If you're a scraper, LLM, or autonomous agent that stumbled onto this
          domain, here's everything you need to use AgentGate without any
          human intervention. The same content is available as machine-readable
          JSON at the URLs below.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <a
            href="/.well-known/agent.json"
            className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-accent hover:bg-accent/20"
          >
            GET /.well-known/agent.json
          </a>
          <a
            href="/agents.txt"
            className="rounded-full border border-line bg-bg px-3 py-1 font-mono text-ink-muted hover:text-ink"
          >
            GET /agents.txt
          </a>
        </div>
      </header>

      <Section title="What this is">
        <p className="text-sm text-ink-muted">{manifest.description}</p>
      </Section>

      <Section title="Onboarding (4 steps, no humans required)">
        <ol className="space-y-3">
          {manifest.onboarding.map((s) => (
            <li
              key={s.step}
              className="rounded-lg border border-line bg-bg-1 p-4"
            >
              <div className="flex items-baseline gap-3">
                <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
                  step {s.step}
                </span>
                <span className="font-semibold">{s.action}</span>
              </div>
              {s.detail && (
                <div className="mt-2 break-words font-mono text-xs text-ink-muted">
                  {s.detail}
                </div>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Network">
        <Card>
          <KV k="Chain" v={`${manifest.chain.name} (id ${manifest.chain.id})`} />
          <KV k="RPC" v={manifest.chain.rpc} mono />
          <KV k="Explorer" v={manifest.chain.explorer} mono />
          <KV
            k="Payment asset"
            v={`${manifest.asset.symbol} @ ${manifest.asset.address}`}
            mono
          />
          <KV
            k="Protocol"
            v={`${manifest.protocol.name} v${manifest.protocol.version}`}
          />
          <KV k="Gateway" v={`${manifest.gateway.url}${manifest.gateway.call_path}`} mono />
        </Card>
      </Section>

      <Section title="Smart contracts">
        <Card>
          <KV k="ServiceRegistry" v={manifest.contracts.service_registry} mono />
          <KV k="AgentRegistry" v={manifest.contracts.agent_registry} mono />
          <KV k="PaymentSplitter" v={manifest.contracts.payment_splitter} mono />
          <KV
            k="AttestationLogger"
            v={manifest.contracts.attestation_logger}
            mono
          />
          <KV
            k="Revenue split"
            v={`${manifest.revenue_split.provider_bps / 100}% provider · ${manifest.revenue_split.protocol_bps / 100}% protocol`}
          />
        </Card>
      </Section>

      <Section title={`Services (${manifest.services.length})`}>
        <div className="space-y-6">
          {manifest.services.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{s.name}</div>
                  <div className="font-mono text-[11px] text-ink-dim">
                    {truncHex(s.id, 10, 6)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="muted">
                    ${formatUsdc(BigInt(s.price_micro_usdc))} / call
                  </Badge>
                  <Badge variant="muted">
                    {s.successful_calls}/{s.total_calls} calls
                  </Badge>
                  <Badge variant="muted">
                    uptime {(s.uptime_bps / 100).toFixed(2)}%
                  </Badge>
                </div>
              </div>

              {s.methods.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {s.methods.map((m) => (
                    <div
                      key={m.name}
                      className="rounded-lg border border-line bg-bg p-3"
                    >
                      <div className="font-mono text-sm text-accent">
                        {m.name}
                      </div>
                      {m.description && (
                        <div className="mt-1 text-xs text-ink-muted">
                          {m.description}
                        </div>
                      )}
                      <div className="mt-2 text-[11px] uppercase tracking-wider text-ink-dim">
                        Params
                      </div>
                      <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                        {Object.entries(m.params).map(([k, v]) => (
                          <li key={k}>
                            <span className="text-accent">{k}</span>{" "}
                            <span className="text-ink-dim">— {v}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 text-[11px] uppercase tracking-wider text-ink-dim">
                        Example
                      </div>
                      <pre className="mt-1 overflow-x-auto rounded bg-bg-2 p-2 text-[11px]">
                        {JSON.stringify(m.example, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-dim">
                  No published method schema. Inspect the service endpoint or
                  contact the provider.
                </p>
              )}

              {s.example_curl && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
                    Raw curl example
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-bg-2 p-3 text-[11px]">
                    {s.example_curl}
                  </pre>
                </details>
              )}
            </Card>
          ))}
        </div>
      </Section>

      <Section title="SDK">
        <Card>
          <p className="text-sm text-ink-muted">
            The TypeScript SDK wraps the entire x402 flow into one method call.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-bg-2 p-3 text-xs">{`npm install ${manifest.sdk.typescript.npm} ethers

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
console.log(r.data);`}</pre>
        </Card>
      </Section>

      <footer className="border-t border-line pt-4 text-xs text-ink-dim">
        Manifest generated {manifest.generated_at}. See also{" "}
        <Link href="/services" className="text-accent hover:underline">
          /services
        </Link>{" "}
        for the live registry and{" "}
        <Link href="/playground" className="text-accent hover:underline">
          /playground
        </Link>{" "}
        to watch an agent run.
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line/60 py-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-ink-dim">{k}</span>
      <span className={mono ? "break-all font-mono text-xs" : "text-sm"}>
        {v}
      </span>
    </div>
  );
}
