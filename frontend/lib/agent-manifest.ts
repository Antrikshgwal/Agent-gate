/// Builds the AgentGate manifest — the single document a scraping agent
/// needs to discover the marketplace, register, fund, and start paying.
///
/// Method schemas live here (not on-chain) because providers don't yet
/// publish them; this is the post-hackathon upgrade path. Keyed by the
/// lowercased service name so a provider just needs to pick a known name
/// to be auto-documented.

import { env } from "./env";
import { getAllServices } from "./data";

export interface ManifestMethod {
  name: string;
  description?: string;
  params: Record<string, string>;
  example: Record<string, unknown>;
}

const METHOD_SCHEMAS: Record<string, ManifestMethod[]> = {
  openweather: [
    {
      name: "get_current_weather",
      description: "Current observed weather for a city.",
      params: {
        city: "string — city name, e.g. 'London'",
        units: "'metric' | 'imperial' (default: metric)",
      },
      example: { city: "London", units: "metric" },
    },
    {
      name: "get_forecast",
      description: "Multi-day forecast (3-hour buckets).",
      params: {
        city: "string",
        days: "integer 1-5 (default: 3)",
      },
      example: { city: "Tokyo", days: 3 },
    },
  ],
  coingecko: [
    {
      name: "get_price",
      description: "Spot price for one or more coin IDs.",
      params: {
        ids: "comma-separated coin IDs, e.g. 'bitcoin,ethereum'",
        vs_currencies: "comma-separated fiat tickers (default: usd)",
      },
      example: { ids: "bitcoin,ethereum", vs_currencies: "usd" },
    },
    {
      name: "get_market_chart",
      description: "Historical price chart for a coin.",
      params: {
        id: "coin id, e.g. 'bitcoin'",
        days: "string — '1' | '7' | '30' | 'max'",
        vs_currency: "fiat ticker (default: usd)",
      },
      example: { id: "bitcoin", days: "1", vs_currency: "usd" },
    },
  ],
};

function methodsFor(name: string): ManifestMethod[] {
  return METHOD_SCHEMAS[name.toLowerCase()] ?? [];
}

export interface AgentManifest {
  $schema: string;
  name: string;
  description: string;
  homepage: string;
  protocol: { name: string; version: string; spec: string };
  gateway: { url: string; call_path: string };
  chain: { id: number; name: string; rpc: string; explorer: string };
  asset: { symbol: string; address: string; decimals: number };
  contracts: {
    service_registry: string;
    agent_registry: string;
    payment_splitter: string;
    attestation_logger: string;
  };
  revenue_split: { provider_bps: number; protocol_bps: number };
  onboarding: { step: number; action: string; detail?: string }[];
  sdk: {
    typescript: { npm: string; example: string };
    raw_http: string;
  };
  services: ManifestService[];
  generated_at: string;
}

export interface ManifestService {
  id: string;
  name: string;
  endpoint: string;
  provider: string;
  price_micro_usdc: string;
  price_usdc: string;
  total_calls: string;
  successful_calls: string;
  uptime_bps: number;
  is_active: boolean;
  methods: ManifestMethod[];
  example_curl: string;
}

export async function buildManifest(origin: string): Promise<AgentManifest> {
  const services = await getAllServices().catch(() => []);
  const gatewayUrl = env.gatewayUrl;

  return {
    $schema: "https://agentgate.xyz/schema/agent-manifest.v1.json",
    name: "AgentGate",
    description:
      "On-chain marketplace where autonomous AI agents pay providers per-call for legacy APIs using the x402 payment protocol. No accounts, no API keys, no human-in-the-loop.",
    homepage: origin,
    protocol: {
      name: "x402",
      version: "2",
      spec: "https://x402.org",
    },
    gateway: {
      url: gatewayUrl,
      call_path: "/api/v1/call",
    },
    chain: {
      id: env.chainId,
      name: "Kite Testnet",
      rpc: env.rpcUrl,
      explorer: env.explorer,
    },
    asset: {
      symbol: "USDC",
      address: env.usdc,
      decimals: 6,
    },
    contracts: {
      service_registry: env.serviceRegistry,
      agent_registry: env.agentRegistry,
      payment_splitter:
        process.env.NEXT_PUBLIC_PAYMENT_SPLITTER ?? "",
      attestation_logger: env.attestationLogger,
    },
    revenue_split: { provider_bps: 9500, protocol_bps: 500 },
    onboarding: [
      {
        step: 1,
        action: "Register an agent DID on-chain",
        detail: `Call AgentRegistry.registerAgent(bytes32 did) on ${env.agentRegistry}. Pick any 32-byte identifier you control.`,
      },
      {
        step: 2,
        action: "Fund your wallet with testnet USDC",
        detail: `USDC contract: ${env.usdc}. Faucet via Kite Passport or the Kite testnet faucet.`,
      },
      {
        step: 3,
        action: "Discover a service",
        detail: `Read ServiceRegistry.getAllServices() at ${env.serviceRegistry}, or use the SDK's findProvider({name, strategy: 'cheapest' | 'best_reputation'}).`,
      },
      {
        step: 4,
        action: "Make a paid call",
        detail: `POST ${gatewayUrl}/api/v1/call → expect HTTP 402 → sign EIP-3009 transferWithAuthorization → POST again with PAYMENT-SIGNATURE header. The SDK does all of this in one call.`,
      },
    ],
    sdk: {
      typescript: {
        npm: "@agentgate/sdk",
        example: `${origin}/agents/example.ts`,
      },
      raw_http: `${origin}/agents`,
    },
    services: services
      .filter((s) => s.isActive)
      .map((s): ManifestService => {
        const uptimeBps =
          s.totalCalls === 0n
            ? 0
            : Number((s.successfulCalls * 10000n) / s.totalCalls);
        const methods = methodsFor(s.name);
        const example = methods[0];
        const example_curl = example
          ? buildCurlExample(s.id, example, gatewayUrl)
          : "";
        return {
          id: s.id,
          name: s.name,
          endpoint: s.endpoint,
          provider: s.provider,
          price_micro_usdc: s.pricePerCall.toString(),
          price_usdc: (Number(s.pricePerCall) / 1_000_000).toFixed(6),
          total_calls: s.totalCalls.toString(),
          successful_calls: s.successfulCalls.toString(),
          uptime_bps: uptimeBps,
          is_active: s.isActive,
          methods,
          example_curl,
        };
      }),
    generated_at: new Date().toISOString(),
  };
}

function buildCurlExample(
  serviceId: string,
  method: ManifestMethod,
  gatewayUrl: string,
): string {
  const body = JSON.stringify(
    {
      service_id: serviceId,
      agent_did: "0xYOUR_AGENT_DID",
      method: method.name,
      params: method.example,
    },
    null,
    2,
  );
  return `curl -X POST ${gatewayUrl}/api/v1/call \\\n  -H 'Content-Type: application/json' \\\n  -d '${body.replace(/\n/g, "\n  ")}'\n# → expect HTTP 402, then re-send with PAYMENT-SIGNATURE header`;
}
