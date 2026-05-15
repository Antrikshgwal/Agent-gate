# OpenWeather provider

Reference AgentGate provider. Holds an OpenWeather API key and resells it
on Kite Chain via the gateway.

## Methods

- `get_current_weather` — params: `{ city, units? }`
- `get_forecast` — params: `{ city, units? }` (24h, 3h steps)

## Run

```bash
cp .env.example .env       # set OPENWEATHER_API_KEY, AGENTGATE_GATEWAY_SECRET
pnpm install
pnpm dev                   # http://localhost:4001
```

## On-chain registration

After deploying publicly, register on `/register` in the frontend:

- **Name** — `OpenWeather` (must match the gateway's display name)
- **Endpoint** — your public URL
- **Price per call** — gross USDC the agent pays (you receive 95%)
- **Stake** — ≥ 100 USDC
