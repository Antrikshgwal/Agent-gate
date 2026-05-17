/* eslint-disable no-console */
/// Seed each registered service with a handful of real calls so the
/// /services page has non-trivial reputation numbers in the demo.
///
/// Run from sdk/: `npx tsx examples/seed.ts`

import * as path from "node:path";
import * as dotenv from "dotenv";
import { AgentGateClient } from "../src/index.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

interface SeedCall {
  label: string;
  serviceIdEnv: string;
  method: string;
  params: Record<string, unknown>;
  times: number;
}

const SEEDS: SeedCall[] = [
  {
    label: "OpenWeather primary",
    serviceIdEnv: "SERVICE_ID_BYTES32",
    method: "get_current_weather",
    params: { city: "London", units: "metric" },
    times: 3,
  },
  {
    label: "OpenWeather budget",
    serviceIdEnv: "SERVICE_ID_OW_BUDGET",
    method: "get_current_weather",
    params: { city: "Tokyo", units: "metric" },
    times: 2,
  },
  {
    label: "CoinGecko",
    serviceIdEnv: "SERVICE_ID_COINGECKO",
    method: "get_price",
    params: { ids: "bitcoin,ethereum", vs_currencies: "usd" },
    times: 2,
  },
];

async function main() {
  const client = new AgentGateClient({
    gatewayUrl: process.env.GATEWAY_URL ?? "http://localhost:3000",
    privateKey: need("PRIVATE_KEY"),
    rpcUrl: need("KITE_RPC_URL"),
    agentDID: need("AGENT_DID_BYTES32"),
  });

  console.log("[seed] payer:", client.payer);

  for (const seed of SEEDS) {
    const serviceId = process.env[seed.serviceIdEnv];
    if (!serviceId) {
      console.warn(`[seed] skipping ${seed.label}: ${seed.serviceIdEnv} not set`);
      continue;
    }
    for (let i = 0; i < seed.times; i++) {
      const t0 = Date.now();
      try {
        const r = await client.call({
          serviceId,
          method: seed.method,
          params: seed.params,
          maxAmount: 100_000n, // 0.1 USDC ceiling
        });
        const ms = Date.now() - t0;
        console.log(
          `[seed] ${seed.label} #${i + 1} → success=${r.success} ${ms}ms tx=${r.payment?.transaction?.slice(0, 10)}`,
        );
      } catch (err) {
        console.error(`[seed] ${seed.label} #${i + 1} failed:`, err);
      }
    }
  }
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
