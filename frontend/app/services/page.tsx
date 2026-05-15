import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HashLink } from "@/components/ui/hash";
import { getAllServices, type Service } from "@/lib/data";
import {
  groupAndSelect,
  isStrategy,
  STRATEGIES,
  STRATEGY_LABELS,
  uptimeBps,
  type SelectionStrategy,
} from "@/lib/discovery";
import { cn } from "@/lib/cn";
import { formatUsdc, truncHex, uptimePct } from "@/lib/format";

export const revalidate = 30;

export default async function ServicesPage({
  searchParams,
}: {
  searchParams?: { strategy?: string };
}) {
  const strategy: SelectionStrategy = isStrategy(searchParams?.strategy)
    ? searchParams.strategy
    : "best_reputation";
  const services = await getAllServices().catch(() => []);
  const groups = groupAndSelect(services, strategy);

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
          API they're reselling. Agents pick a provider with{" "}
          <code className="font-mono text-xs">findProvider()</code>, pay over
          x402, and the gateway routes the call to that provider's backend.
        </p>
      </header>

      <StrategyToggle current={strategy} />

      {groups.length === 0 ? (
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
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.name} className="space-y-3">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-semibold tracking-tight">
                  {g.name}
                </h2>
                <span className="text-xs text-ink-dim">
                  {g.services.length}{" "}
                  {g.services.length === 1 ? "provider" : "providers"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {g.services.map((svc) => (
                  <ServiceCard
                    key={svc.id}
                    svc={svc}
                    isSelected={svc.id === g.selectedId}
                    showSelectedBadge={g.services.length > 1}
                    strategy={strategy}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function StrategyToggle({ current }: { current: SelectionStrategy }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg-1 p-3 text-xs">
      <span className="text-ink-dim">findProvider strategy:</span>
      {STRATEGIES.map((s) => {
        const active = s === current;
        return (
          <Link
            key={s}
            href={s === "best_reputation" ? "/services" : `/services?strategy=${s}`}
            className={cn(
              "rounded-full border px-3 py-1 transition-colors",
              active
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-line bg-bg text-ink-muted hover:border-accent/30 hover:text-ink",
            )}
          >
            {STRATEGY_LABELS[s]}
          </Link>
        );
      })}
      <span className="ml-auto text-ink-dim">
        Highlighted card = what{" "}
        <code className="font-mono">sdk.findProvider()</code> would pick.
      </span>
    </div>
  );
}

function ServiceCard({
  svc,
  isSelected,
  showSelectedBadge,
  strategy,
}: {
  svc: Service;
  isSelected: boolean;
  showSelectedBadge: boolean;
  strategy: SelectionStrategy;
}) {
  const uptime = uptimePct(svc.totalCalls, svc.successfulCalls);
  return (
    <Link href={`/services/${svc.id}`} className="group">
      <Card
        className={cn(
          "h-full transition-colors",
          isSelected
            ? "border-accent/60 ring-1 ring-accent/30"
            : "hover:border-accent/40",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-base font-semibold tracking-tight">
              {svc.name}
            </div>
            <div className="mt-0.5 truncate text-xs text-ink-muted">
              {hostOf(svc.endpoint)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {svc.isActive ? (
              <Badge variant="success">active</Badge>
            ) : (
              <Badge variant="bad">inactive</Badge>
            )}
            {showSelectedBadge && isSelected && (
              <Badge variant="default" className="border-accent/40 bg-accent/10 text-accent">
                {STRATEGY_LABELS[strategy]}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-line bg-bg p-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-dim">
            Price per call
          </div>
          <div className="mt-0.5 text-2xl font-semibold text-accent">
            ${formatUsdc(svc.pricePerCall)}
          </div>
          <div className="mt-1 text-[10px] text-ink-dim">
            Provider receives 95% · Protocol 5%
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

        <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-ink-dim">
          <span>{truncHex(svc.id, 8, 6)}</span>
          <span>uptime {uptimeBps(svc) / 100}bps</span>
        </div>
      </Card>
    </Link>
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
