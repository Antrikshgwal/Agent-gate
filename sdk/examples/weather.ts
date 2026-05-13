/* eslint-disable no-console */
/// End-to-end demo: use the SDK to ask AgentGate's gateway for the weather
/// in London, paying via x402. Reads .env from the repo root.

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

async function main() {
  const client = new AgentGateClient({
    gatewayUrl: process.env.GATEWAY_URL ?? "http://localhost:3000",
    privateKey: need("PRIVATE_KEY"), // deployer/payer in this demo
    rpcUrl: need("KITE_RPC_URL"),
    agentDID: need("AGENT_DID_BYTES32"),
  });

  console.log("[agent] payer wallet:", client.payer);

  const result = await client.call({
    serviceId: need("SERVICE_ID_BYTES32"),
    method: "get_current_weather",
    params: { city: "London", units: "metric" },
    maxAmount: 50_000n, // 0.05 USDC ceiling
  });

  console.log("\n[result]", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
