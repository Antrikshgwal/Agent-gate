import Link from "next/link";
import { ArrowRight, Sparkles, Zap, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { getAllServices, type Service } from "@/lib/data";
import {
  groupAndSelect,
  isStrategy,
  STRATEGIES,
  STRATEGY_LABELS,
  uptimeBps,
  type SelectionStrategy,
} from "@/lib/discovery";
import { cn } from "@/lib/utils";
import { formatUsdc, truncHex, uptimePct } from "@/lib/format";

export const revalidate = 30;

const STRATEGY_ICONS: Record<SelectionStrategy, React.ReactNode> = {
  best_reputation: <Sparkles className="h-3 w-3" />,
  cheapest: <Coins className="h-3 w-3" />,
  first_match: <Zap className="h-3 w-3" />,
};

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
    <div className="space-y-10">
      <header className="space-y-4">
        <Badge variant="outline" className="gap-1.5">
          <Sparkles className="h-3 w-3 text-brand" />
          Service directory
        </Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Providers on{" "}
          <span className="text-gradient">the open market.</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Every card below is a real provider with staked USDC and a real
          backend. Pick a strategy — the SDK&apos;s{" "}
          <code className="font-mono text-xs text-foreground">findProvider()</code>{" "}
          uses the same logic to choose for an agent.
        </p>
      </header>

      <StrategyToggle current={strategy} />

      {groups.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground">No services registered yet.</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            Register the first <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {groups.map((g) => (
            <section key={g.name} className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  {g.name}
                </h2>
                <span className="text-xs text-muted-foreground">
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
    <div className="surface flex flex-wrap items-center gap-2 p-3 text-xs">
      <span className="text-muted-foreground">findProvider strategy:</span>
      {STRATEGIES.map((s) => {
        const active = s === current;
        return (
          <Link
            key={s}
            href={s === "best_reputation" ? "/services" : `/services?strategy=${s}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition",
              active
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:border-brand/30 hover:text-foreground",
            )}
          >
            {STRATEGY_ICONS[s]}
            {STRATEGY_LABELS[s]}
          </Link>
        );
      })}
      <span className="ml-auto text-muted-foreground">
        Highlighted = SDK&apos;s pick
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
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Link
          href={`/services/${svc.id}`}
          className={cn(
            "group relative block overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.03] to-transparent p-5 backdrop-blur-xl transition-all",
            "hover:-translate-y-0.5 hover:border-brand/40",
            isSelected
              ? "border-brand/50 shadow-[0_0_0_1px_rgba(52,225,255,0.3),0_20px_40px_-20px_rgba(52,225,255,0.4)]"
              : "border-white/[0.06]",
          )}
        >
          {isSelected && (
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/15 blur-3xl" />
          )}

          <div className="relative flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight">
                {svc.name}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {hostOf(svc.endpoint)}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {svc.isActive ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20">
                  active
                </Badge>
              ) : (
                <Badge variant="destructive">inactive</Badge>
              )}
              {showSelectedBadge && isSelected && (
                <Badge
                  variant="outline"
                  className="border-brand/40 bg-brand/10 text-brand"
                >
                  {STRATEGY_LABELS[strategy]}
                </Badge>
              )}
            </div>
          </div>

          <div className="relative mt-5 rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Price per call
            </div>
            <div className="mt-0.5 font-display text-3xl font-semibold text-gradient">
              ${formatUsdc(svc.pricePerCall)}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              95% provider · 5% protocol
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-3 text-xs">
            <Mini label="Uptime" value={`${uptime.toFixed(1)}%`} />
            <Mini
              label="Calls"
              value={Number(svc.totalCalls).toLocaleString()}
            />
            <Mini label="Stake" value={`$${formatUsdc(svc.reputationStake)}`} />
          </div>

          <div className="relative mt-4 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>{truncHex(svc.id, 6, 4)}</span>
            <span className="inline-flex items-center gap-1 text-brand opacity-0 transition group-hover:opacity-100">
              view <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="top">
        <div className="space-y-2 text-xs">
          <div className="font-semibold">{svc.name}</div>
          <div className="text-muted-foreground">{svc.endpoint}</div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Kv k="Provider" v={truncHex(svc.provider)} />
            <Kv k="Uptime bps" v={`${uptimeBps(svc)}`} />
            <Kv
              k="Calls"
              v={`${svc.successfulCalls}/${svc.totalCalls}`}
            />
            <Kv k="Stake" v={`$${formatUsdc(svc.reputationStake)}`} />
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm">{value}</div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono">{v}</span>
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
