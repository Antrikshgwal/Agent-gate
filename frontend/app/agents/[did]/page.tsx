import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardValue, CardSub } from "@/components/ui/card";
import { HashLink } from "@/components/ui/hash";
import {
  getAgent,
  getAllServices,
  getAttestationsByAgent,
} from "@/lib/data";
import {
  ageDays,
  formatUsdc,
  relativeTime,
  truncHex,
} from "@/lib/format";

export const revalidate = 15;

export default async function AgentProfilePage({
  params,
}: {
  params: { did: string };
}) {
  const did = params.did as `0x${string}`;
  const [agent, attestations, services] = await Promise.all([
    getAgent(did).catch(() => null),
    getAttestationsByAgent(did, 50).catch(() => []),
    getAllServices().catch(() => []),
  ]);
  if (!agent) notFound();

  const total = agent.successfulCalls + agent.failedCalls;
  const successRate = total === 0n ? 0 : Number((agent.successfulCalls * 10000n) / total) / 100;
  const days = ageDays(Number(agent.createdAt));

  // Reputation breakdown using the same constants the contract uses.
  const REP = { successMax: 700, ageMax: 200, volumeMax: 100, ageCapDays: 60, volumeCap: 1000n * 10n ** 6n };
  const successPts = total === 0n ? 500 : Math.floor(Number((agent.successfulCalls * BigInt(REP.successMax)) / total));
  const agePts = days > REP.ageCapDays ? REP.ageMax : Math.floor((days * REP.ageMax) / REP.ageCapDays);
  const volumePts = agent.totalSpent > REP.volumeCap
    ? REP.volumeMax
    : Math.floor(Number((agent.totalSpent * BigInt(REP.volumeMax)) / REP.volumeCap));

  const serviceById = new Map(services.map((s) => [s.id, s]));

  return (
    <div className="space-y-10">
      <header>
        <Link href="/" className="text-xs text-ink-dim hover:text-ink">
          ← home
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-ink-dim">Agent</div>
            <h1 className="mt-1 break-all font-mono text-sm text-ink md:text-base">
              {agent.did}
            </h1>
            <div className="mt-2 text-xs text-ink-muted">
              owned by <HashLink value={agent.owner} kind="address" /> · joined{" "}
              {relativeTime(Number(agent.createdAt))}
            </div>
          </div>
          {agent.isActive ? (
            <Badge variant="success">active</Badge>
          ) : (
            <Badge variant="muted">inactive</Badge>
          )}
        </div>
      </header>

      {/* Reputation panel */}
      <section>
        <Card className="bg-gradient-to-br from-bg-1 to-bg-2">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <CardHeader>Reputation</CardHeader>
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-semibold tracking-tight text-accent">
                  {Number(agent.reputationScore)}
                </span>
                <span className="text-lg text-ink-dim">/ 1000</span>
              </div>
              <CardSub>
                {Number(agent.reputationScore) >= 750
                  ? "Excellent"
                  : Number(agent.reputationScore) >= 500
                    ? "Good"
                    : Number(agent.reputationScore) >= 250
                      ? "Fair"
                      : "Building"}
              </CardSub>
            </div>
            <div className="grid grow grid-cols-3 gap-3 text-xs md:max-w-md">
              <RepStat label="Success rate" pts={successPts} max={REP.successMax} />
              <RepStat label="Account age" pts={agePts} max={REP.ageMax} />
              <RepStat label="Volume" pts={volumePts} max={REP.volumeMax} />
            </div>
          </div>
        </Card>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>Total spent</CardHeader>
          <CardValue>${formatUsdc(agent.totalSpent)}</CardValue>
        </Card>
        <Card>
          <CardHeader>Success rate</CardHeader>
          <CardValue>{successRate.toFixed(1)}%</CardValue>
          <CardSub>
            {agent.successfulCalls.toString()}/{total.toString()} calls
          </CardSub>
        </Card>
        <Card>
          <CardHeader>Failed calls</CardHeader>
          <CardValue>{agent.failedCalls.toString()}</CardValue>
        </Card>
        <Card>
          <CardHeader>Account age</CardHeader>
          <CardValue>{days}d</CardValue>
        </Card>
      </section>

      {/* Attestations */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wider text-ink-dim">
          Recent x402 payments
        </h2>
        {attestations.length === 0 ? (
          <Card className="text-center text-ink-muted">No attestations yet.</Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-bg-2 text-left text-[11px] uppercase tracking-wider text-ink-dim">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Latency</th>
                  <th className="px-4 py-3 font-medium">Payment tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attestations.map((a, i) => {
                  const svc = serviceById.get(a.serviceId);
                  return (
                    <tr key={i} className="text-ink-muted">
                      <td className="px-4 py-3 text-xs">
                        {relativeTime(Number(a.timestamp))}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {svc ? (
                          <Link
                            href={`/services/${a.serviceId}`}
                            className="text-ink hover:text-accent"
                          >
                            {svc.name}
                          </Link>
                        ) : (
                          <code className="font-mono text-ink-dim">
                            {truncHex(a.serviceId)}
                          </code>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        ${formatUsdc(a.amountPaid)}
                      </td>
                      <td className="px-4 py-3">
                        {a.success ? (
                          <Badge variant="success">success</Badge>
                        ) : (
                          <Badge variant="bad">failed</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{a.latencyMs.toString()}ms</td>
                      <td className="px-4 py-3">
                        <HashLink value={a.x402PaymentHash} kind="tx" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}

function RepStat({
  label,
  pts,
  max,
}: {
  label: string;
  pts: number;
  max: number;
}) {
  const pct = Math.min(100, Math.round((pts / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-ink-dim">{label}</span>
        <span className="text-xs text-ink">{pts}/{max}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
