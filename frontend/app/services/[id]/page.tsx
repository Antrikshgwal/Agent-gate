import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardValue } from "@/components/ui/card";
import { HashLink } from "@/components/ui/hash";
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

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/services"
          className="text-xs text-ink-dim hover:text-ink"
        >
          ← all services
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{svc.name}</h1>
            <div className="mt-1 text-sm text-ink-muted">{svc.endpoint}</div>
          </div>
          {svc.isActive ? (
            <Badge variant="success">active</Badge>
          ) : (
            <Badge variant="bad">inactive</Badge>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>Price / call</CardHeader>
          <CardValue>${formatUsdc(svc.pricePerCall)}</CardValue>
        </Card>
        <Card>
          <CardHeader>Reputation stake</CardHeader>
          <CardValue>${formatUsdc(svc.reputationStake)}</CardValue>
        </Card>
        <Card>
          <CardHeader>Total calls</CardHeader>
          <CardValue>{Number(svc.totalCalls).toLocaleString()}</CardValue>
        </Card>
        <Card>
          <CardHeader>Uptime</CardHeader>
          <CardValue>{uptime.toFixed(2)}%</CardValue>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wider text-ink-dim">
          Identity
        </h2>
        <Card>
          <dl className="grid grid-cols-1 gap-y-3 md:grid-cols-2">
            <Row label="Service ID">
              <code className="font-mono text-xs text-ink-muted">
                {truncHex(svc.id, 10, 8)}
              </code>
            </Row>
            <Row label="Provider">
              <HashLink value={svc.provider} kind="address" />
            </Row>
            <Row label="Schema hash">
              <code className="font-mono text-xs text-ink-muted">
                {truncHex(svc.schemaHash, 10, 8)}
              </code>
            </Row>
            <Row label="Registered">
              <span className="text-sm">
                {relativeTime(Number(svc.createdAt))}
              </span>
            </Row>
          </dl>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wider text-ink-dim">
          How to call this service
        </h2>
        <Card>
          <pre className="overflow-x-auto rounded-md bg-bg p-4 text-xs leading-relaxed">
            <code className="font-mono text-ink-muted">{`import { AgentGateClient } from "@agentgate/sdk";

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
});`}</code>
          </pre>
        </Card>
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
      <dt className="w-28 shrink-0 text-xs uppercase tracking-wider text-ink-dim">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
