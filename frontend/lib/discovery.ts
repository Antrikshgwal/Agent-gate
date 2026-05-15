/// Frontend mirror of the SDK's findProvider selection logic. Kept in
/// sync with sdk/src/discovery.ts so what an agent would pick at runtime
/// matches what the browse page shows.

import type { Service } from "./data";

export type SelectionStrategy = "cheapest" | "best_reputation" | "first_match";

export const STRATEGY_LABELS: Record<SelectionStrategy, string> = {
  cheapest: "Cheapest",
  best_reputation: "Best reputation",
  first_match: "First match",
};

export const STRATEGIES: SelectionStrategy[] = [
  "cheapest",
  "best_reputation",
  "first_match",
];

export function isStrategy(v: string | undefined): v is SelectionStrategy {
  return v === "cheapest" || v === "best_reputation" || v === "first_match";
}

export interface ServiceGroup {
  name: string;
  services: Service[];
  selectedId: `0x${string}` | null;
}

export function uptimeBps(s: Service): number {
  return s.totalCalls === 0n
    ? 0
    : Number((s.successfulCalls * 10_000n) / s.totalCalls);
}

/// Group active services by case-insensitive name and pick a winner per
/// group using the supplied strategy. Inactive services are excluded.
export function groupAndSelect(
  services: Service[],
  strategy: SelectionStrategy,
): ServiceGroup[] {
  const byName = new Map<string, Service[]>();
  for (const s of services) {
    if (!s.isActive) continue;
    const key = s.name.toLowerCase();
    const arr = byName.get(key) ?? [];
    arr.push(s);
    byName.set(key, arr);
  }

  const groups: ServiceGroup[] = [];
  for (const [, members] of byName) {
    const selected = selectByStrategy(members, strategy);
    groups.push({
      name: members[0]!.name,
      services: members,
      selectedId: selected ? selected.id : null,
    });
  }
  // Larger groups first (more interesting), then alphabetical.
  groups.sort(
    (a, b) =>
      b.services.length - a.services.length ||
      a.name.localeCompare(b.name),
  );
  return groups;
}

export function selectByStrategy(
  candidates: Service[],
  strategy: SelectionStrategy,
): Service | null {
  if (candidates.length === 0) return null;
  switch (strategy) {
    case "cheapest":
      return candidates.reduce((a, b) =>
        a.pricePerCall <= b.pricePerCall ? a : b,
      );
    case "best_reputation":
      return candidates.reduce((a, b) => {
        const ua = uptimeBps(a);
        const ub = uptimeBps(b);
        if (ua !== ub) return ua > ub ? a : b;
        return a.totalCalls >= b.totalCalls ? a : b;
      });
    case "first_match":
      return candidates[0]!;
  }
}
