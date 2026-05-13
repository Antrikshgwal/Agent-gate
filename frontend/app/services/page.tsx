import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HashLink } from "@/components/ui/hash";
import { getAllServices } from "@/lib/data";
import { formatUsdc, truncHex, uptimePct } from "@/lib/format";

export const revalidate = 30;

export default async function ServicesPage() {
  const services = await getAllServices().catch(() => []);

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-wider text-ink-dim">
          Service Directory
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          On-chain providers
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Each provider below has staked USDC in{" "}
          <code className="font-mono text-xs">ServiceRegistry</code> against the
          API they're reselling. Agents pick a provider, pay over x402, and the
          gateway routes the call to the provider's backend.
        </p>
      </header>

      {services.length === 0 ? (
        <Card className="text-center text-ink-muted">
          <p>No services registered yet.</p>
          <p className="mt-2 text-xs">
            Be the first — go to{" "}
            <Link href="/register" className="text-accent hover:underline">
              /register
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => {
            const uptime = uptimePct(svc.totalCalls, svc.successfulCalls);
            return (
              <Link
                key={svc.id}
                href={`/services/${svc.id}`}
                className="group"
              >
                <Card className="h-full transition-colors hover:border-accent/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-semibold tracking-tight">
                        {svc.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink-muted">
                        {hostOf(svc.endpoint)}
                      </div>
                    </div>
                    {svc.isActive ? (
                      <Badge variant="success">active</Badge>
                    ) : (
                      <Badge variant="bad">inactive</Badge>
                    )}
                  </div>

                  <div className="mt-5 rounded-lg border border-line bg-bg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-ink-dim">
                      Price per call
                    </div>
                    <div className="mt-0.5 text-2xl font-semibold text-accent">
                      ${formatUsdc(svc.pricePerCall)}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <Stat label="Uptime" value={`${uptime.toFixed(2)}%`} />
                    <Stat label="Calls" value={Number(svc.totalCalls).toLocaleString()} />
                    <Stat label="Stake" value={`$${formatUsdc(svc.reputationStake)}`} />
                    <Stat
                      label="Provider"
                      value={<HashLink value={svc.provider} kind="address" />}
                    />
                  </div>

                  <div className="mt-4 text-[11px] font-mono text-ink-dim">
                    {truncHex(svc.id, 8, 6)}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-dim">
        {label}
      </div>
      <div className="mt-0.5 text-ink">{value}</div>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
