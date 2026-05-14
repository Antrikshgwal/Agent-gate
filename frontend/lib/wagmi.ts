import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { kiteTestnet } from "./chain";
import { env } from "./env";

export const wagmiConfig = getDefaultConfig({
  appName: "AgentGate",
  projectId: env.wcProjectId || "MISSING_WALLETCONNECT_PROJECT_ID",
  chains: [kiteTestnet],
  ssr: true,
});
