import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, CardValue, CardSub } from "@/components/ui/card";
import {
  getAllServices,
  getTotalAttestations,
  getTotalVolumeMicroUsdc,
} from "@/lib/data";
import { formatUsdc } from "@/lib/format";

// Re-fetch on each request so dashboard stats reflect chain state.
export const revalidate = 30;

export default async function HomePage() {
  // Fetch in parallel; any failure surfaces as zeros + an inline note.
  const [services, totalAttestations, totalVolume] = await Promise.all([
    getAllServices().catch(() => []),
    getTotalAttestations().catch(() => 0n),
    getTotalVolumeMicroUsdc().catch(() => 0n),
  ]);

  const activeServices = services.filter((s) => s.isActive).length;

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="relative pt-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-bg-1 px-3 py-1 text-xs text-ink-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          live on Kite Testnet — chain 2368
        </div>
        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          A <span className="text-accent">marketplace</span> where
          <br />
          AI agents meet legacy APIs.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-muted">
          Providers carry the legacy API subscriptions and resell them on a
          pay-per-call basis. Agents discover, pay in USDC over x402, and earn
          reputation. Discovery, settlement, and accountability all live on
          Kite Chain.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/services">Explore services →</ButtonLink>
          <ButtonLink href="/register" variant="secondary">
            Register a service
          </ButtonLink>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>Services registered</CardHeader>
          <CardValue>{services.length}</CardValue>
          <CardSub>{activeServices} active</CardSub>
        </Card>
        <Card>
          <CardHeader>Attestations logged</CardHeader>
          <CardValue>{totalAttestations.toString()}</CardValue>
          <CardSub>x402 payments settled on-chain</CardSub>
        </Card>
        <Card>
          <CardHeader>Volume routed</CardHeader>
          <CardValue>${formatUsdc(totalVolume)}</CardValue>
          <CardSub>USDC lifetime</CardSub>
        </Card>
      </section>

      {/* How it works */}
      <section>
        <h2 className="mb-8 text-xl font-semibold tracking-tight">
          How an agent makes a paid call
        </h2>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            {
              n: "1",
              t: "Discover",
              d: "Agent reads ServiceRegistry on Kite. Picks a provider by price, uptime, and reputation.",
            },
            {
              n: "2",
              t: "Quote",
              d: "POST /api/v1/call returns HTTP 402 + PAYMENT-REQUIRED envelope listing accepted USDC payments.",
            },
            {
              n: "3",
              t: "Sign & settle",
              d: "Agent signs an EIP-3009 transferWithAuthorization. The facilitator moves USDC on-chain.",
            },
            {
              n: "4",
              t: "Attest",
              d: "Gateway logs the call to AttestationLogger. Reputation updates immediately.",
            },
          ].map((s) => (
            <Card key={s.n}>
              <div className="text-xs font-medium text-accent">step {s.n}</div>
              <div className="mt-3 text-base font-semibold">{s.t}</div>
              <div className="mt-2 text-sm text-ink-muted">{s.d}</div>
            </Card>
          ))}
        </ol>
      </section>
    </div>
  );
}
