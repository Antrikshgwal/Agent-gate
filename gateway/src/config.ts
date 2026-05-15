import * as dotenv from "dotenv";
import * as path from "node:path";

// Walk up from gateway/ to repo root .env (single source of truth).
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ override: false }); // also load gateway/.env if present

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: parseInt(optional("GATEWAY_PORT", "3000"), 10),

  kite: {
    rpcUrl: () => required("KITE_RPC_URL"),
    chainId: parseInt(optional("KITE_CHAIN_ID", "2368"), 10),
    facilitatorUrl: () => optional("KITE_FACILITATOR_URL", "https://facilitator.pieverse.io"),
    // Pieverse expects CAIP-2 form ("eip155:<chainId>"). Always derive from
    // KITE_CHAIN_ID rather than honoring a legacy env value.
    facilitatorNetwork: () =>
      `eip155:${optional("KITE_CHAIN_ID", "2368")}`,
  },

  gateway: {
    walletAddress: () => required("GATEWAY_WALLET_ADDRESS"),
    privateKey: () => required("GATEWAY_PRIVATE_KEY"),
    // Shared secret sent as X-AgentGate-Auth to every provider. Each
    // provider must hold the same value in its AGENTGATE_GATEWAY_SECRET.
    providerAuthSecret: () => required("AGENTGATE_GATEWAY_SECRET"),
    // ms allowed for provider HTTP call before we treat it as an outage.
    providerCallTimeoutMs: parseInt(optional("PROVIDER_CALL_TIMEOUT_MS", "15000"), 10),
  },

  contracts: {
    serviceRegistry: () => required("SERVICE_REGISTRY_ADDR"),
    agentRegistry: () => required("AGENT_REGISTRY_ADDR"),
    attestationLogger: () => required("ATTESTATION_LOGGER_ADDR"),
    paymentSplitter: () => required("PAYMENT_SPLITTER_ADDR"),
    usdc: () => required("USDC_ADDR"),
  },
};
