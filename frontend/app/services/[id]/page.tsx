import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Activity, Coins, Shield, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/stat-card";
import { HashLink } from "@/components/ui/hash";
import { ServiceChart } from "@/components/service-chart";
import { CopyInline } from "@/components/copy-inline";
import { getServiceById } from "@/lib/data";
import { formatUsdc, truncHex, uptimePct, relativeTime } from "@/lib/format";

export const revalidate = 30;

export default async function ServiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id as `0x${string}`;
  const svc = await getServiceById(id).catch(() => null);
  if (!svc) notFound();

  const uptime = uptimePct(svc.totalCalls, svc.successfulCalls);
  const failed = svc.totalCalls - svc.successfulCalls;

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/services"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          all services
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              {svc.name}
            </h1>
            <div className="mt-1.5 font-mono text-sm text-muted-foreground">
              {svc.endpoint}
            </div>
          </div>
          {svc.isActive ? (
            <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20">
              active
            </Badge>
          ) : (
            <Badge variant="destructive">inactive</Badge>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Price / call"
          value={`$${formatUsdc(svc.pricePerCall)}`}
          icon={<Coins className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Stake"
          value={`$${formatUsdc(svc.reputationStake)}`}
          icon={<Shield className="h-4 w-4" />}
          accent="violet"
          delay={0.05}
        />
        <StatCard
          label="Total calls"
          value={Number(svc.totalCalls).toLocaleString()}
          icon={<Activity className="h-4 w-4" />}
          accent="pink"
          delay={0.1}
        />
        <StatCard
          label="Uptime"
          value={`${uptime.toFixed(1)}%`}
          icon={<BarChart3 className="h-4 w-4" />}
          accent="brand"
          delay={0.15}
        />
      </section>

      <section className="surface-strong p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Lifetime call mix
            </div>
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Performance
            </h2>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="text-emerald-400">●</span>{" "}
            {Number(svc.successfulCalls).toLocaleString()} ok ·{" "}
            <span className="text-red-400">●</span>{" "}
            {Number(failed).toLocaleString()} failed
          </div>
        </div>
        <ServiceChart
          successful={Number(svc.successfulCalls)}
          failed={Number(failed)}
        />
      </section>

      <section className="surface p-6">
        <h2 className="mb-4 text-[11px] uppercase tracking-widest text-muted-foreground">
          Identity
        </h2>
        <dl className="grid grid-cols-1 gap-y-3 md:grid-cols-2">
          <Row label="Service ID">
            <CopyInline value={svc.id} display={truncHex(svc.id, 10, 8)} />
          </Row>
          <Row label="Provider">
            <HashLink value={svc.provider} kind="address" />
          </Row>
          <Row label="Schema hash">
            <CopyInline
              value={svc.schemaHash}
              display={truncHex(svc.schemaHash, 10, 8)}
            />
          </Row>
          <Row label="Registered">
            <span className="text-sm">
              {relativeTime(Number(svc.createdAt))}
            </span>
          </Row>
        </dl>
      </section>

      <section className="surface p-6">
        <h2 className="mb-4 text-[11px] uppercase tracking-widest text-muted-foreground">
          Call this service
        </h2>
        <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/40 p-4 font-mono text-[11px] leading-relaxed">
{`import { AgentGateClient } from "@agentgate/sdk";

const client = new AgentGateClient({
  gatewayUrl: "${process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3000"}",
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  rpcUrl: process.env.KITE_RPC_URL!,
  agentDID: "<your-bytes32-DID>",
});

const result = await client.call({
  serviceId: "${truncHex(svc.id, 10, 6)}",
  method: "<adapter-method>",
  params: { /* … */ },
  maxAmount: ${(svc.pricePerCall * 105n) / 100n}n,
});`}
        </pre>
        <Separator className="my-5" />
        <div className="flex gap-3">
          <Link
            href={`/playground?service=${svc.id}`}
            className="text-sm text-brand hover:underline"
          >
            Try it in the playground →
          </Link>
        </div>
      </section>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-32 shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
