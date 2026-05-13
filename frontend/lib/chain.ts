import { createPublicClient, defineChain, http } from "viem";
import { env } from "./env";

/// Kite Testnet (chain 2368) as a viem Chain. We declare this locally so we
/// don't depend on viem shipping it.
export const kiteTestnet = defineChain({
  id: 2368,
  name: "Kite Testnet",
  nativeCurrency: { name: "Kite", symbol: "KITE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-testnet.gokite.ai/"] },
    public: { http: ["https://rpc-testnet.gokite.ai/"] },
  },
  blockExplorers: {
    default: { name: "Kitescan", url: "https://testnet.kitescan.ai" },
  },
  testnet: true,
});

/// Public client for read-only chain calls. Cached across requests in dev/prod.
export const publicClient = createPublicClient({
  chain: kiteTestnet,
  transport: http(env.rpcUrl),
});
