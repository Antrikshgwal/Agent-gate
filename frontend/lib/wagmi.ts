import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { kiteTestnet } from "./chain";
import { env } from "./env";

/// RainbowKit + wagmi config. We feed only the Kite testnet so users can't
/// accidentally try to write to mainnet from the dashboard.
export const wagmiConfig = getDefaultConfig({
  appName: "AgentGate",
  // Falls back to a placeholder so the module still loads in environments
  // without a WalletConnect project id (read-only pages keep working);
  // wallet connection will simply fail with a clearer error.
  projectId: env.wcProjectId || "MISSING_WALLETCONNECT_PROJECT_ID",
  chains: [kiteTestnet],
  ssr: true,
});
