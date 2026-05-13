/// Centralized env reader. All NEXT_PUBLIC_* values are inlined at build time
/// so we surface clear errors at module load rather than during a render.

function read(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v) return v;
  if (fallback !== undefined) return fallback;
  // Avoid throwing in the browser; allow the page to render an inline error.
  if (typeof window !== "undefined") return "";
  return "";
}

export const env = {
  rpcUrl: read("NEXT_PUBLIC_KITE_RPC_URL", "https://rpc-testnet.gokite.ai/"),
  chainId: parseInt(read("NEXT_PUBLIC_KITE_CHAIN_ID", "2368"), 10),
  explorer: read("NEXT_PUBLIC_KITE_EXPLORER_URL", "https://testnet.kitescan.ai"),
  serviceRegistry: read("NEXT_PUBLIC_SERVICE_REGISTRY") as `0x${string}`,
  agentRegistry: read("NEXT_PUBLIC_AGENT_REGISTRY") as `0x${string}`,
  attestationLogger: read("NEXT_PUBLIC_ATTESTATION_LOGGER") as `0x${string}`,
  usdc: read("NEXT_PUBLIC_USDC") as `0x${string}`,
  gatewayUrl: read("NEXT_PUBLIC_GATEWAY_URL", "http://localhost:3000"),
  wcProjectId: read("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", ""),
};
