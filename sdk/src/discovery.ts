import { Contract, JsonRpcProvider } from "ethers";

const SERVICE_REGISTRY_ABI = [
  "function getAllServices() view returns (tuple(bytes32 id, string name, string endpoint, bytes32 schemaHash, address provider, uint256 pricePerCall, uint256 reputationStake, uint256 totalCalls, uint256 successfulCalls, bool isActive, uint64 createdAt)[])",
];

export interface DiscoveredService {
  id: string;
  name: string;
  endpoint: string;
  provider: string;
  pricePerCall: bigint;
  reputationStake: bigint;
  totalCalls: bigint;
  successfulCalls: bigint;
  /// Successful / total, in basis points (10_000 = 100%). 0 if no calls yet.
  uptimeBps: number;
}

export type SelectionStrategy = "cheapest" | "best_reputation" | "first_match";

export interface FindProviderOptions {
  rpcUrl: string;
  serviceRegistry: string;
  name: string;
  strategy?: SelectionStrategy;
  /// Minimum uptime in basis points (e.g. 9500 = 95%). Services below this are skipped.
  minUptimeBps?: number;
  /// Minimum successful calls required (use 0 to allow brand-new providers).
  minTotalCalls?: number;
}

/// Resolve an on-chain service by name + selection strategy.
///
/// Returns null if no active service matches. The returned `id` is what you
/// pass as `serviceId` to AgentGateClient.call().
export async function findProvider(opts: FindProviderOptions): Promise<DiscoveredService | null> {
  const provider = new JsonRpcProvider(opts.rpcUrl);
  const registry = new Contract(opts.serviceRegistry, SERVICE_REGISTRY_ABI, provider);

  const raw: unknown[] = await registry.getAllServices();
  const all = raw.map(toDiscovered);
  const nameLower = opts.name.toLowerCase();
  const minUptime = opts.minUptimeBps ?? 0;
  const minCalls = BigInt(opts.minTotalCalls ?? 0);

  const candidates = all.filter(
    (s) =>
      s.name.toLowerCase() === nameLower &&
      // active services only; the registry struct includes isActive but we
      // strip it from DiscoveredService since callers don't filter on it.
      s.endpoint.length > 0 &&
      s.uptimeBps >= minUptime &&
      s.totalCalls >= minCalls,
  );

  if (candidates.length === 0) return null;

  const strategy = opts.strategy ?? "first_match";
  switch (strategy) {
    case "cheapest":
      return candidates.reduce((a, b) => (a.pricePerCall <= b.pricePerCall ? a : b));
    case "best_reputation":
      // Rank by uptime, break ties by total calls (more data = stronger signal).
      return candidates.reduce((a, b) => {
        if (a.uptimeBps !== b.uptimeBps) return a.uptimeBps > b.uptimeBps ? a : b;
        return a.totalCalls >= b.totalCalls ? a : b;
      });
    case "first_match":
      return candidates[0]!;
  }
}

function toDiscovered(raw: any): DiscoveredService {
  const totalCalls: bigint = raw.totalCalls;
  const successfulCalls: bigint = raw.successfulCalls;
  const uptimeBps =
    totalCalls === 0n ? 0 : Number((successfulCalls * 10_000n) / totalCalls);
  return {
    id: raw.id,
    name: raw.name,
    endpoint: raw.endpoint,
    provider: raw.provider,
    pricePerCall: raw.pricePerCall,
    reputationStake: raw.reputationStake,
    totalCalls,
    successfulCalls,
    uptimeBps,
  };
}
