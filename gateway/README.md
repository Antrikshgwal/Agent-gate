# AgentGate Gateway

Express service that implements the x402 payment protocol on top of the
AgentGate on-chain contracts and the Pieverse facilitator on Kite testnet.

## Responsibilities

1. **List services** — reads `ServiceRegistry` on Kite Chain and exposes the
   directory at `GET /api/v1/services`.
2. **Quote payments** — when an agent posts to `POST /api/v1/call` without
   an `X-PAYMENT` header, returns HTTP **402** with the payee address,
   the price (service fee + 2% gateway fee), and the facilitator URL.
3. **Verify + settle** — on the retry with `X-PAYMENT`, posts the envelope
   to `${KITE_FACILITATOR_URL}/v2/settle` and waits for an on-chain USDC
   transfer.
4. **Execute** — routes the call to the appropriate `ServiceAdapter`
   (currently `OpenWeather`) and forwards the upstream response.
5. **Log attestation** — calls `AttestationLogger.logAttestation` on chain
   so the registries' stats and the agent's reputation stay in sync.

The gateway never creates payment authorizations — that's the agent's job
(via `kpass agent:session execute`). The gateway only verifies what comes
in over the wire.

## Configuration

All config comes from the repo-root `.env`. See `../.env.example`.

Required to boot at all: `KITE_RPC_URL`, `KITE_FACILITATOR_URL`,
`KITE_FACILITATOR_NETWORK`, `GATEWAY_PORT` (default 3000).

Required for blockchain reads/writes (lazy — only when those routes are
hit): `SERVICE_REGISTRY_ADDR`, `AGENT_REGISTRY_ADDR`,
`ATTESTATION_LOGGER_ADDR`, `USDC_ADDR`, `GATEWAY_WALLET_ADDRESS`,
`GATEWAY_PRIVATE_KEY`.

Required per-adapter: `OPENWEATHER_API_KEY`.

## Run

```bash
pnpm install
pnpm dev       # tsx watch, hot-reload
# or
pnpm build && pnpm start
```

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness probe |
| GET | `/api/v1/services` | List on-chain services with formatted prices |
| POST | `/api/v1/call` | x402 endpoint (returns 402 without `X-PAYMENT`, executes with it) |

## Manual integration test

With the contracts deployed and one service registered on `ServiceRegistry`:

1. **Quote a call** (expect HTTP 402):
   ```bash
   curl -i -X POST http://localhost:3000/api/v1/call \
     -H 'Content-Type: application/json' \
     -d '{
       "service_id": "0x...",
       "agent_did": "did:kite:...",
       "method": "get_current_weather",
       "params": {"city": "London"}
     }'
   ```
2. **Pay and execute** via kpass:
   ```bash
   kpass agent:session create \
     --task-summary "Fetch London weather" \
     --max-amount-per-tx 0.05 \
     --ttl 10m \
     --output json
   # ...approve in browser, copy session-id...

   kpass agent:session execute \
     --url http://localhost:3000/api/v1/call \
     --method POST \
     --headers '{"Content-Type":"application/json"}' \
     --body '{"service_id":"0x...","agent_did":"did:kite:...","method":"get_current_weather","params":{"city":"London"}}' \
     --output json
   ```

The gateway will log to stdout each settlement and attestation tx hash.
