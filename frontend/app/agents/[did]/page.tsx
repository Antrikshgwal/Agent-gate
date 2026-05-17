import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Activity, Coins, Calendar, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
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
  const successRate =
    total === 0n ? 0 : Number((agent.successfulCalls * 10000n) / total) / 100;
  const days = ageDays(Number(agent.createdAt));

  const REP = {
    successMax: 700,
    ageMax: 200,
    volumeMax: 100,
    ageCapDays: 60,
    volumeCap: 1000n * 10n ** 6n,
  };
  const successPts =
    total === 0n
      ? 500
      : Math.floor(Number((agent.successfulCalls * BigInt(REP.successMax)) / total));
  const agePts =
    days > REP.ageCapDays ? REP.ageMax : Math.floor((days * REP.ageMax) / REP.ageCapDays);
  const volumePts =
    agent.totalSpent > REP.volumeCap
      ? REP.volumeMax
      : Math.floor(Number((agent.totalSpent * BigInt(REP.volumeMax)) / REP.volumeCap));

  const serviceById = new Map(services.map((s) => [s.id, s]));
  const rep = Number(agent.reputationScore);
  const tier =
    rep >= 750 ? "Excellent" : rep >= 500 ? "Good" : rep >= 250 ? "Fair" : "Building";

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          home
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Agent
            </div>
            <h1 className="mt-1 break-all font-mono text-sm md:text-base">
              {agent.did}
            </h1>
            <div className="mt-2 text-xs text-muted-foreground">
              owned by <HashLink value={agent.owner} kind="address" /> · joined{" "}
              {relativeTime(Number(agent.createdAt))}
            </div>
          </div>
          {agent.isActive ? (
            <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20">
              active
            </Badge>
          ) : (
            <Badge variant="secondary">inactive</Badge>
          )}
        </div>
      </div>

      <section className="surface-strong relative overflow-hidden p-8">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand/15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Reputation
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-6xl font-semibold tracking-tight text-gradient">
                {rep}
              </span>
              <span className="text-lg text-muted-foreground">/ 1000</span>
            </div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Award className="h-3 w-3 text-brand" />
              {tier}
            </div>
          </div>
          <div className="grid grow grid-cols-3 gap-4 text-xs md:max-w-md">
            <RepStat label="Success" pts={successPts} max={REP.successMax} />
            <RepStat label="Age" pts={agePts} max={REP.ageMax} />
            <RepStat label="Volume" pts={volumePts} max={REP.volumeMax} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total spent"
          value={`$${formatUsdc(agent.totalSpent)}`}
          icon={<Coins className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Success rate"
          value={`${successRate.toFixed(1)}%`}
          sub={`${agent.successfulCalls.toString()}/${total.toString()} calls`}
          icon={<Activity className="h-4 w-4" />}
          accent="violet"
          delay={0.05}
        />
        <StatCard
          label="Failed calls"
          value={agent.failedCalls.toString()}
          icon={<Activity className="h-4 w-4" />}
          accent="pink"
          delay={0.1}
        />
        <StatCard
          label="Account age"
          value={`${days}d`}
          icon={<Calendar className="h-4 w-4" />}
          accent="brand"
          delay={0.15}
        />
      </section>

      <section>
        <h2 className="mb-4 text-[11px] uppercase tracking-widest text-muted-foreground">
          Recent x402 payments
        </h2>
        {attestations.length === 0 ? (
          <div className="surface py-10 text-center text-sm text-muted-foreground">
            No attestations yet.
          </div>
        ) : (
          <div className="surface overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Latency</th>
                  <th className="px-4 py-3 font-medium">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {attestations.map((a, i) => {
                  const svc = serviceById.get(a.serviceId);
                  return (
                    <tr key={i} className="text-muted-foreground transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-xs">
                        {relativeTime(Number(a.timestamp))}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {svc ? (
                          <Link
                            href={`/services/${a.serviceId}`}
                            className="text-foreground hover:text-brand"
                          >
                            {svc.name}
                          </Link>
                        ) : (
                          <code className="font-mono text-muted-foreground">
                            {truncHex(a.serviceId)}
                          </code>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        ${formatUsdc(a.amountPaid)}
                      </td>
                      <td className="px-4 py-3">
                        {a.success ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20">
                            success
                          </Badge>
                        ) : (
                          <Badge variant="destructive">failed</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {a.latencyMs.toString()}ms
                      </td>
                      <td className="px-4 py-3">
                        <HashLink value={a.x402PaymentHash} kind="tx" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-xs">
          {pts}/{max}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-brand"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
