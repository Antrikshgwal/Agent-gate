import Link from "next/link";
import {
  ArrowRight,
  PlayCircle,
  LayoutGrid,
  Bot,
  Coins,
  Activity,
  Sparkles,
  Zap,
  ShieldCheck,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { AgentFlow } from "@/components/agent-flow";
import { CallTicker } from "@/components/call-ticker";
import {
  getAllServices,
  getTotalAttestations,
  getTotalVolumeMicroUsdc,
} from "@/lib/data";
import { formatUsdc, truncHex } from "@/lib/format";

export const revalidate = 30;

export default async function HomePage() {
  const [services, totalAttestations, totalVolume] = await Promise.all([
    getAllServices().catch(() => []),
    getTotalAttestations().catch(() => 0n),
    getTotalVolumeMicroUsdc().catch(() => 0n),
  ]);

  const activeServices = services.filter((s) => s.isActive).length;

  const tickerItems = services
    .filter((s) => s.totalCalls > 0n)
    .slice(0, 8)
    .map((s) => ({
      service: s.name,
      amount: formatUsdc(s.pricePerCall),
      agent: truncHex(s.provider, 4, 4),
    }));

  return (
    <div className="space-y-24 pb-12">
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative pt-12 md:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Link
              href="/agents"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground transition hover:border-brand/40 hover:text-foreground"
            >
              <Sparkles className="h-3 w-3 text-brand" />
              <span>Now serving the agent web — read the manifest</span>
              <ArrowRight className="h-3 w-3" />
            </Link>

            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-tight md:text-6xl lg:text-7xl">
              The internet,{" "}
              <span className="text-gradient">priced per call</span> for AI
              agents.
            </h1>

            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              AgentGate turns any API into a pay-per-call resource. Agents
              discover, pay USDC over x402, and earn on-chain reputation — no
              accounts, no API keys, no humans in the loop.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="group">
                <Link href="/playground">
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Run an agent
                  <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/services">
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  Browse services
                </Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Live on Kite Testnet · chain 2368
              </span>
              <span>x402 v2</span>
              <span>EIP-3009 USDC</span>
              <span>95 / 5 split</span>
            </div>
          </div>

          <div className="lg:col-span-2">
            <AgentFlow />
          </div>
        </div>
      </section>

      {/* ── Live ticker ─────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            <Activity className="mr-1.5 inline h-3 w-3 text-brand" />
            Recent activity
          </div>
          <Link
            href="/services"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            view all →
          </Link>
        </div>
        <CallTicker items={tickerItems} />
      </section>

      {/* ── Stats ───────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Services live"
          value={services.length}
          sub={`${activeServices} active`}
          icon={<Boxes className="h-4 w-4" />}
          accent="brand"
          delay={0.0}
        />
        <StatCard
          label="Attestations on-chain"
          value={totalAttestations.toString()}
          sub="x402 payments settled"
          icon={<ShieldCheck className="h-4 w-4" />}
          accent="violet"
          delay={0.1}
        />
        <StatCard
          label="USDC volume"
          value={`$${formatUsdc(totalVolume)}`}
          sub="lifetime, all services"
          icon={<Coins className="h-4 w-4" />}
          accent="pink"
          delay={0.2}
        />
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-3">
            How it works
          </Badge>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            From request to settlement in{" "}
            <span className="text-gradient">one round-trip.</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            The whole x402 dance fits in a single HTTP exchange. No API keys,
            no subscriptions, no humans.
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              n: "01",
              title: "Discover",
              body: "Read ServiceRegistry on Kite. Filter by price, uptime, reputation.",
              icon: LayoutGrid,
            },
            {
              n: "02",
              title: "Quote",
              body: "POST to the gateway. Get a 402 with the USDC price and a nonce.",
              icon: Zap,
            },
            {
              n: "03",
              title: "Sign & settle",
              body: "Sign an EIP-3009 authorization. Facilitator pulls USDC on-chain.",
              icon: Coins,
            },
            {
              n: "04",
              title: "Attest",
              body: "Gateway logs the call. Provider gets 95%, protocol 5%. Reputation updates.",
              icon: ShieldCheck,
            },
          ].map((s, i) => (
            <div
              key={s.n}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl transition hover:border-brand/30"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/10 opacity-0 blur-2xl transition group-hover:opacity-100" />
              <div className="relative flex items-start justify-between">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {s.n}
                </span>
                <s.icon className="h-4 w-4 text-brand" />
              </div>
              <div className="relative mt-6 text-base font-semibold">
                {s.title}
              </div>
              <div className="relative mt-2 text-sm text-muted-foreground">
                {s.body}
              </div>
              {i < 3 && (
                <ArrowRight className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/40 lg:block" />
              )}
            </div>
          ))}
        </ol>
      </section>

      {/* ── Two columns: agents / providers ──────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="surface-strong relative overflow-hidden p-8">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/15 blur-3xl" />
          <Bot className="h-6 w-6 text-brand" />
          <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            For agents
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Drop in our SDK. One call replaces a procurement cycle.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/40 p-4 font-mono text-[11px] leading-relaxed">
            <span className="text-muted-foreground">{`// pick a provider, call it, get data`}</span>
            {`
const p = await findProvider({ name: "OpenWeather" });
const r = await agentgate.call({
  serviceId: p.id,
  method: "get_current_weather",
  params: { city: "London" },
});`}
          </pre>
          <Button asChild variant="link" className="mt-4 px-0 text-brand">
            <Link href="/agents">
              Read the manifest
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="surface-strong relative overflow-hidden p-8">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-violet/15 blur-3xl" />
          <Boxes className="h-6 w-6 text-brand-violet" />
          <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            For providers
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Carry the API subscription, set a price, take 95% of every call.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-brand-violet">→</span> Stake USDC for
              skin-in-the-game reputation
            </li>
            <li className="flex gap-2">
              <span className="text-brand-violet">→</span> Set per-call price
              and SLA, change anytime
            </li>
            <li className="flex gap-2">
              <span className="text-brand-violet">→</span> Auto-settlement; no
              invoicing, no chargebacks
            </li>
          </ul>
          <Button asChild variant="link" className="mt-4 px-0 text-brand-violet">
            <Link href="/register">
              Register a service
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-brand/10 via-brand-violet/10 to-brand-pink/10 p-12 text-center">
        <div className="absolute inset-0 bg-grid-faint opacity-50" />
        <h2 className="relative font-display text-3xl font-semibold tracking-tight md:text-5xl">
          Try it. <span className="text-gradient">Right now.</span>
        </h2>
        <p className="relative mx-auto mt-3 max-w-lg text-muted-foreground">
          Hit a real provider, sign a real payment, watch a real attestation
          land on-chain. No wallet needed.
        </p>
        <div className="relative mt-6 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/playground">
              <PlayCircle className="mr-2 h-4 w-4" />
              Open playground
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
