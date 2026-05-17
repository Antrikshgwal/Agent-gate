# AgentGate

> An on-chain marketplace where AI agents pay USDC for legacy APIs via **x402**,
> and where independent providers resell that infrastructure with reputation
> staked on-chain.

AgentGate is a hackathon submission for **Kite AI Hackathon 2025 (Agentic
Commerce track)**. The gateway acts as a router + load balancer + selection
engine sitting between agents and infra/service providers: agents discover
providers on-chain, pay per call in USDC, and the gateway forwards the
request, splits the payment 95 / 5, and records an attestation.

Deployed on **Kite Chain testnet (chain ID 2368)**, settled via the
**Pieverse x402 facilitator**, paid in **USDC** (`transferWithAuthorization` /
EIP-3009).

---

## The pitch in one diagram

```
  ┌────────┐   1. findProvider() (on-chain)    ┌──────────────────┐
  │ Agent  │ ────────────────────────────────▶ │ ServiceRegistry  │
  │  (SDK) │                                   │  (Kite Chain)    │
  └───┬────┘                                   └──────────────────┘
      │ 2. POST /api/v1/call  (no payment)
      ▼                                        ┌──────────────────┐
  ┌────────┐   3. HTTP 402 PAYMENT-REQUIRED    │ PaymentSplitter  │
  │Gateway │ ─── payTo = PaymentSplitter ────▶ │   (95% / 5%)     │
  └───┬────┘                                   └──────────────────┘
      │ 4. EIP-3009 signed authorization (USDC.transferWithAuthorization)
      ▼
  ┌─────────────────────┐                      ┌──────────────────┐
  │ Pieverse facilitator│  5. settle on-chain  │   USDC token     │
  │  (off-gateway)      │ ────────────────────▶│  (Kite Chain)    │
  └─────────────────────┘                      └──────────────────┘
      │ 6. settlement landed
      ▼
  ┌────────┐  7. POST {endpoint}/v1/call       ┌──────────────────┐
  │Gateway │ ────────────────────────────────▶ │ Provider server  │
  │        │   X-AgentGate-Auth: <secret>      │ (holds API key)  │
  └───┬────┘                                   └──────────────────┘
      │ 8. splitter.distribute(serviceId, amount) → 95% provider, 5% protocol
      ▼
  ┌────────┐  9. AttestationLogger.logAttestation → updates reputation
  │ Agent  │ ◀── { success, data, payment_tx, attestation_tx } ──
  └────────┘
```

The gateway never holds the upstream API key. The **provider** does. That is
the structural argument for AgentGate: the gateway is a thin router, not a
bottleneck, and any operator can publish their own paid API by staking USDC
and running ~80 lines of Express.

---

## What's in this repo

| Directory | What it does |
| --- | --- |
| `contracts/` | Solidity contracts (Foundry): `ServiceRegistry`, `AgentRegistry`, `AttestationLogger`, `PaymentSplitter` |
| `gateway/` | Express server: handles x402 negotiation, settles via Pieverse, forwards to providers, calls the splitter, logs attestations |
| `providers/template/` | 60-line forkable skeleton — start here to add a provider |
| `providers/openweather/` | Reference provider reselling OpenWeather |
| `providers/coingecko/` | Reference provider reselling CoinGecko's public price API (no key needed) |
| `sdk/` | TypeScript client: `findProvider`, `AgentGateClient.call`, EIP-3009 signing |
| `frontend/` | Next.js 14 + Tailwind: marketplace browser, provider registration, agent dashboards |

---

## Live testnet addresses (Kite Chain, chain ID 2368)

| Contract | Address |
| --- | --- |
| `ServiceRegistry` | `0xF1b879E314e05ED8d6381AaF30793f2B204C39B2` |
| `AgentRegistry` | `0x29527d55D2Fe6d777378920581A9cc2F76eEe6ba` |
| `AttestationLogger` | `0xBf8319a66b4079D07f1230a7222882b6218c565b` |
| `PaymentSplitter` | `0x77C268964E38CeB6b654D36eB4aBedE82B615f4b` |
| `USDC (MockUSDC)` | `0x0309764915AFC7a2a7CDd1E64c58a57c1F1705E3` |
| Gateway wallet | `0xe5A044f3d61D2381bded585AC357be9d9e8aD564` |

Block explorer: <https://testnet.kitescan.ai>

### Registered services

| Service | Provider | Price/call | Notes |
| --- | --- | --- | --- |
| OpenWeather (primary) | `0x820c…12D1` | $0.01 | 100% uptime, longest history |
| OpenWeather (budget) | `0xA403…7C44` | $0.005 | cheaper, less proven |
| CoinGecko | `0x974B…05d3` | $0.02 | crypto prices, no API key |

---

## Why this isn't just "yet another x402 demo"

Most x402 examples are a single server gating one endpoint. AgentGate adds the
three pieces that make a **marketplace**:

1. **On-chain discovery + reputation.** `ServiceRegistry` is a real directory.
   Every successful or failed call updates `totalCalls / successfulCalls` for
   the provider and `reputationScore` for the agent. The SDK ships a
   `findProvider({ name, strategy })` helper so agents pick by `cheapest`,
   `best_reputation`, or `first_match` — and the `/services` page mirrors
   that exact logic so you can see which one wins at a glance.

2. **Payment splitting in a contract, not in the gateway.** `payTo` on the
   402 quote is the `PaymentSplitter`. The gateway settles **into** the
   splitter, then calls `distribute(serviceId, amount)`, which reads the
   provider out of `ServiceRegistry` and fans out 95 % / 5 %. No off-chain
   bookkeeping, no gateway holding funds in flight.

3. **Provider HTTP contract that any operator can implement in ~80 lines.**
   `POST /v1/call` with `{ method, params }`, `X-AgentGate-Auth` shared
   secret, returns `{ success, data, error }`. The gateway speaks one wire
   format to every provider; the gateway code does not change when you add
   a new upstream API.

---

## Quick start

### Prerequisites

- Node 20+, `pnpm`
- Foundry (`forge`, `cast`)
- A Kite Chain testnet wallet with KITE for gas

### Install

```bash
make install
```

### Run the whole demo

```bash
make demo
```

Starts (with prefixed logs in one terminal):

- gateway on `:3000`
- OpenWeather primary on `:4001`
- OpenWeather budget on `:4002`
- CoinGecko on `:4003`
- frontend on `:3001`

Ctrl+C kills the whole group.

### Seed reputation

```bash
make seed   # runs sdk/examples/seed.ts → 7 paid calls across the 3 services
```

### Check on-chain state

```bash
make services   # cast call ServiceRegistry.getAllServices()
make health     # curl every local /v1/health
```

---

## End-to-end flow (the 30-second demo)

```bash
# 1. Spin up everything.
make demo

# 2. (other terminal) Pick a provider on-chain.
#    The SDK does it via findProvider; the frontend mirrors that logic
#    at http://localhost:3001/services?strategy=cheapest
#    Toggle the strategy and watch the highlighted card change.

# 3. Make a paid call.
cd sdk && npx tsx examples/weather.ts
```

You should see a JSON response with real weather data plus three tx hashes:
`payment.transaction`, `payment.distribution_tx_hash`, and
`payment.attestation_tx_hash`. All three land in the same KiteScan view.

---

## Smart contracts

All four are pure-Solidity, no upgradability, no proxies. Foundry tests live
in `contracts/test/`.

### `ServiceRegistry`

- `registerService(name, endpoint, schemaHash, pricePerCall, stake, SLA)` — pulls
  USDC stake via `transferFrom`. `MIN_STAKE = 100 USDC`.
- `updateEndpoint(id, newEndpoint)` — provider-only, lets ops rotate the
  backend without re-staking.
- `getAllServices()` — front end / SDK discovery feed.
- `updateServiceStats(id, success)` — only callable by `AttestationLogger`.

### `AgentRegistry`

- `registerAgent(did)` — DID is a `bytes32` derived from the agent's Kite
  Passport identity. Starts at neutral reputation (500/1000).
- Reputation = 700·successRate + 200·age + 100·volume, recomputed on every
  attestation.

### `AttestationLogger`

- The only contract the gateway needs `onlyOwner` access to. Each call
  writes a single attestation and updates both registries.
- This is what makes reputation tamper-evident: the gateway can't fake a
  successful call, only log what actually happened.

### `PaymentSplitter`

- `distribute(serviceId, amount)` — gateway-owned; reads the provider out
  of `ServiceRegistry`, transfers 95 % to them and 5 % to the protocol
  treasury. Rounding favors the protocol so the splitter is always drained
  to zero per call (verified in `PaymentSplitter.t.sol`).
- `sweep()` — owner-only escape hatch for residual dust.

---

## x402 details

We implement x402 **v2** against Pieverse (`https://facilitator.pieverse.io`).

- Network is CAIP-2: `eip155:2368` (Pieverse's expected format).
- Quote envelope shape:
  `{ x402Version, paymentPayload: { x402Version, payload, accepted }, paymentRequirements }`
  — `accepted` mirrors `paymentRequirements`. The shape was reverse-engineered
  from Pieverse's Python lib; both `gateway/src/x402/` and `sdk/src/` agree on it.
- Asset is the deployed MockUSDC. EIP-3009 `transferWithAuthorization` is
  signed by the agent and submitted by Pieverse — the gateway never holds
  the agent's signature beyond settlement.
- `payTo` on every 402 quote is the **PaymentSplitter address**, not the
  gateway. The gateway has no claim on funds in flight.

---

## Repository layout

```
agent-gate/
├── contracts/                  Foundry workspace
│   ├── src/                    ServiceRegistry, AgentRegistry, AttestationLogger, PaymentSplitter
│   ├── test/                   forge tests (10+ for splitter alone)
│   ├── script/Deploy.s.sol     deploys all four with correct wiring
│   └── deployments/2368.json   addresses for Kite testnet
├── gateway/                    Express + ethers.js
│   ├── src/routes/call.ts      402 → settle → forward → split → attest
│   ├── src/blockchain/         on-chain reads + write helpers
│   └── src/x402/facilitator.ts Pieverse client
├── providers/
│   ├── template/               60-line forkable skeleton
│   ├── openweather/            reference provider (paid upstream)
│   ├── coingecko/              reference provider (free upstream)
│   └── README.md               gateway↔provider RPC contract
├── sdk/                        TypeScript client
│   ├── src/client.ts           AgentGateClient.call (x402 round-trip)
│   ├── src/discovery.ts        findProvider({ name, strategy })
│   ├── src/sign.ts             EIP-3009 signing helpers
│   └── examples/weather.ts     end-to-end demo call
├── frontend/                   Next.js 14 App Router
│   ├── app/page.tsx            landing
│   ├── app/services/           browse + strategy-aware selection UI
│   ├── app/register/           on-chain provider registration form
│   ├── app/agents/[did]/       agent dashboards
│   └── lib/discovery.ts        mirrors sdk/src/discovery.ts exactly
├── Makefile                    install / build / typecheck / demo / seed
└── .env                        single source of truth for addresses + keys
```

---

## Adding a new provider

This is the path you'd take in production. The gateway code does not change.

```bash
cp -r providers/template providers/my-service
cd providers/my-service
# 1. Edit src/server.ts: rename SERVICE_NAME, add methods to the dispatcher,
#    call your upstream API.
# 2. Set OPENWEATHER_API_KEY-style env vars + AGENTGATE_GATEWAY_SECRET.
pnpm install && pnpm dev
# 3. Deploy publicly (Fly.io, Railway, Render — any Node host).
# 4. Go to http://localhost:3001/register, connect provider wallet, fill
#    in name / endpoint / pricePerCall / stake / SLA. Submit.
```

The gateway starts routing the moment `registerService` is mined.

---

## Production-readiness notes

- **No secrets in the gateway.** The shared `AGENTGATE_GATEWAY_SECRET` is a
  v1 simplification — v2 should rotate per-provider secrets fetched from a
  KMS at startup.
- **Splitter ownership** is the gateway wallet, which is also the protocol
  treasury. In production these would be separate addresses (operator vs.
  protocol).
- **Slashing** is implemented (`ServiceRegistry.slashStake`) but only
  callable by the registry owner. A production system would wire this to
  an SLA-monitoring oracle.
- **MockUSDC** is used on testnet because the Kite faucet doesn't ship real
  USDC; the production swap is one address change in `.env`.

---

## Acknowledgements

- **Kite AI** for the chain + Passport SDK
- **Pieverse** for the x402 v2 facilitator (and for shipping the Python
  reference that let us reverse-engineer the envelope shape)
- **OpenZeppelin** for the contract primitives
- **shadcn / Tailwind / Next.js** for the frontend stack
