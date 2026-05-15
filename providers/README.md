# Providers

Each subdirectory here is a **standalone service**, run by an independent
operator, that exposes an x402-marketed API through the AgentGate gateway.

A provider is the entity that:

1. Holds the upstream API subscription (e.g. an OpenWeather API key, an
   OpenAI org seat, a Nansen account, etc.).
2. Stakes USDC in `ServiceRegistry` on Kite Chain and registers its public
   `service.endpoint` URL.
3. Exposes a tiny HTTP server at that endpoint speaking the
   gateway↔provider RPC contract (below).
4. Receives 95% of every call's USDC payment automatically via
   `PaymentSplitter`.

The gateway never imports anything from this directory — providers are
independent processes. The dirs below exist as **reference + template**;
in production each provider would live in its own repo.

## Layout

| Directory | Purpose |
| --- | --- |
| [`template/`](./template/) | Minimal forkable skeleton. ~40 lines of Express. Start here when adding a new provider. |
| [`openweather/`](./openweather/) | Reference implementation that resells the free OpenWeather API. |

## Gateway ↔ Provider RPC contract

The gateway speaks one wire format to every provider; differences live behind the provider's
own dispatcher. This means a single gateway can route to any number of providers
without ever knowing what each one resells.

### Request

```
POST <service.endpoint>/v1/call
Content-Type: application/json
X-AgentGate-Auth: <shared-secret>
X-AgentGate-Request-Id: <uuid>            # optional, for tracing
X-AgentGate-Agent-DID: 0x<bytes32>        # who's calling, for the provider's records

{
  "method": "get_current_weather",
  "params": { "city": "London", "units": "metric" }
}
```

- `X-AgentGate-Auth` carries the shared secret. The provider rejects any
  request whose header doesn't match its `AGENTGATE_GATEWAY_SECRET` env var.
  Constant-time compare is recommended.
- `method` is provider-defined. The provider's dispatcher decides what each
  one does.

### Response

```
HTTP 200
{
  "success": true,
  "data": <provider-defined>,
  "error": null
}
```

or, on business failure:

```
HTTP 200
{
  "success": false,
  "data": null,
  "error": "Invalid city name"
}
```

- HTTP non-2xx is treated as a *provider outage* and counts as a failed
  call. Use 2xx with `success: false` for *expected* failures (bad params,
  upstream returned 4xx, etc.) so the attestation can record latency
  cleanly.
- Provider MAY return additional fields; the gateway forwards `data`
  verbatim to the agent.

### Discovery (optional)

```
GET <service.endpoint>/v1/health
{ "ok": true, "name": "OpenWeather", "methods": ["get_current_weather", "get_forecast"] }
```

Not required for routing, but useful for ops and for the frontend to
verify a registered endpoint is alive.

## Adding a new provider

1. `cp -r providers/template providers/<your-service>`
2. Edit `src/server.ts`: rename `name`, add your methods to the dispatcher,
   wire each method's logic to whatever upstream API you're reselling.
3. Set `OPENWEATHER_API_KEY`-style env vars for your upstream credentials.
4. Set `AGENTGATE_GATEWAY_SECRET` (must match the gateway's value).
5. `pnpm install && pnpm dev` — listens on `PORT` (default 4000).
6. Deploy to wherever (Fly.io, Railway, Vercel — any Node host works).
7. Register on chain via the AgentGate frontend `/register` page,
   pointing the `endpoint` field at your public URL.

That's it. The gateway picks up your service the moment your
`registerService` tx is mined — no gateway code change required.
