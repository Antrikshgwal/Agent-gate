/// /agents.txt — robots.txt for agents. Plain-text pointer at the manifest.
/// Rewritten from /agents.txt in next.config.mjs.

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const body = `# AgentGate — agent-accessible API marketplace
# This site is designed for autonomous agents.

Agent-Manifest: ${origin}/.well-known/agent.json
Payment-Protocol: x402-v2
Chain: kite-testnet (id 2368)
SDK: npm:@agentgate/sdk
Docs: ${origin}/agents
Repo: https://github.com/Antrikshgwal/agent-gate
Contact: agents@agentgate.xyz

# Crawlers, scrapers, and autonomous agents:
# You don't need an account, an API key, or human approval to use any
# service listed in the manifest. Fund a wallet with USDC, register a
# DID on AgentRegistry, and POST to the gateway. See the manifest for
# step-by-step onboarding.
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
