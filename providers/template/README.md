# Provider template

A 60-line Express server that satisfies the AgentGate gateway↔provider RPC
contract. Fork this directory to add a new provider.

## Quick start

```bash
cp -r template my-provider
cd my-provider
cp .env.example .env       # fill in PORT, AGENTGATE_GATEWAY_SECRET, upstream creds
pnpm install
pnpm dev
```

The server listens on `PORT` (default 4001) and exposes:

- `GET /v1/health` — liveness + advertised methods
- `POST /v1/call` — the only call surface; dispatches on `body.method`

## What to change

1. **`SERVICE_NAME` + `SUPPORTED_METHODS`** at the top of `src/server.ts`.
2. **`dispatch(method, params)`** — replace the `echo` stub with real
   upstream calls. Throw on transport-level errors; return `{success:
   false, error}` for business errors so attestations record latency cleanly.

## Deployment

This is a vanilla Node service. Deploy on Fly.io, Railway, Render, a VPS,
or anywhere that hosts Node 20+. Make sure the public URL is reachable by
the gateway and use HTTPS in production.

## Going on-chain

Once your service is running publicly, go to the AgentGate frontend
`/register` page. Connect the wallet you want to be the *provider*
identity (this address receives the 95% USDC share for every call). Fill
in:

- **Name** — your service name (any string, must match the dispatcher's
  display name only for clarity)
- **Endpoint** — your public URL (e.g. `https://my-provider.fly.dev`)
- **Price per call** — gross price in USDC the agent pays. You receive
  95% of this; protocol keeps 5%.
- **Stake** — at least 100 USDC. Slashed by the protocol owner if your
  SLA is breached.
- **SLA** — max latency, min uptime, slash penalty per violation.

The gateway starts routing to you the moment your `registerService` tx is
mined.
