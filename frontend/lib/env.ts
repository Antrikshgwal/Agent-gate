/// Centralized env reader.
///
/// IMPORTANT: Next.js only inlines `process.env.NEXT_PUBLIC_*` at build time
/// when accessed as a LITERAL property (e.g. `process.env.NEXT_PUBLIC_FOO`).
/// Dynamic access like `process.env[name]` does NOT get replaced on the
/// client — every var comes back as undefined. So every public var here
/// must be referenced explicitly by name.

function pick(value: string | undefined, fallback?: string): string {
  if (value && value.length > 0) return value;
  if (fallback !== undefined) return fallback;
  return "";
}

export const env = {
  rpcUrl: pick(
    process.env.NEXT_PUBLIC_KITE_RPC_URL,
    "https://rpc-testnet.gokite.ai/",
  ),
  chainId: parseInt(
    pick(process.env.NEXT_PUBLIC_KITE_CHAIN_ID, "2368"),
    10,
  ),
  explorer: pick(
    process.env.NEXT_PUBLIC_KITE_EXPLORER_URL,
    "https://testnet.kitescan.ai",
  ),
  serviceRegistry: pick(
    process.env.NEXT_PUBLIC_SERVICE_REGISTRY,
  ) as `0x${string}`,
  agentRegistry: pick(
    process.env.NEXT_PUBLIC_AGENT_REGISTRY,
  ) as `0x${string}`,
  attestationLogger: pick(
    process.env.NEXT_PUBLIC_ATTESTATION_LOGGER,
  ) as `0x${string}`,
  usdc: pick(process.env.NEXT_PUBLIC_USDC) as `0x${string}`,
  gatewayUrl: pick(
    process.env.NEXT_PUBLIC_GATEWAY_URL,
    "http://localhost:3000",
  ),
  wcProjectId: pick(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, ""),
};
