# CoinGecko provider

AgentGate provider that resells CoinGecko's public price API. No API key
required — exists as a demonstration that AgentGate can route to any
upstream, not just keyed services.

## Methods

- `get_price` — params: `{ ids: "bitcoin,ethereum", vs_currencies?: "usd" }`
- `get_market_chart` — params: `{ id: "bitcoin", days?: "1", vs_currency?: "usd" }`

## Run

```bash
cp .env.example .env
pnpm install
pnpm dev     # http://localhost:4003
```

Register on-chain via `/register` once running.
