.PHONY: help install build test typecheck \
        dev gateway provider-openweather provider-openweather-budget provider-coingecko frontend \
        demo seed services health clean

# Default: print help.
help:
	@echo "AgentGate — common tasks"
	@echo ""
	@echo "  make install                 install deps in every workspace"
	@echo "  make build                   compile contracts + typecheck all TS"
	@echo "  make test                    run forge tests"
	@echo "  make typecheck               typecheck gateway, sdk, frontend, providers"
	@echo ""
	@echo "  make demo                    start gateway + 3 providers + frontend (foreground, ^C to stop)"
	@echo "  make seed                    seed each registered service with a few SDK calls"
	@echo "  make services                print the on-chain service registry"
	@echo "  make health                  hit every local /health endpoint"
	@echo ""
	@echo "  make gateway                 run just the gateway"
	@echo "  make provider-openweather    run primary OpenWeather provider (port 4001)"
	@echo "  make provider-openweather-budget"
	@echo "                               run budget OpenWeather competitor (port 4002)"
	@echo "  make provider-coingecko      run CoinGecko provider (port 4003)"
	@echo "  make frontend                run Next.js frontend (port 3001)"
	@echo ""
	@echo "  make clean                   kill anything we started on ports 3000/3001/4001-4003"

install:
	cd contracts && forge install
	cd gateway && pnpm install
	cd sdk && pnpm install
	cd frontend && pnpm install
	cd providers/openweather && pnpm install
	cd providers/coingecko && pnpm install

build: typecheck
	cd contracts && forge build

test:
	cd contracts && forge test

typecheck:
	cd gateway && pnpm typecheck
	cd sdk && pnpm typecheck || true
	cd frontend && pnpm typecheck || cd frontend && npx tsc --noEmit
	cd providers/openweather && pnpm typecheck
	cd providers/coingecko && pnpm typecheck

gateway:
	cd gateway && pnpm dev

provider-openweather:
	cd providers/openweather && pnpm dev

provider-openweather-budget:
	cd providers/openweather && PORT=4002 npx tsx watch src/server.ts

provider-coingecko:
	cd providers/coingecko && pnpm dev

frontend:
	cd frontend && pnpm dev

# Start every process needed for the demo. Each child prefixes its
# log line; Ctrl+C kills the whole group via `trap`.
demo:
	@echo "[demo] starting gateway + 3 providers + frontend"
	@trap 'kill 0' INT TERM EXIT; \
	  (cd gateway && pnpm dev 2>&1 | sed 's/^/[gateway   ] /') & \
	  (cd providers/openweather && pnpm dev 2>&1 | sed 's/^/[ow:4001   ] /') & \
	  (cd providers/openweather && PORT=4002 npx tsx watch src/server.ts 2>&1 | sed 's/^/[ow:4002   ] /') & \
	  (cd providers/coingecko && pnpm dev 2>&1 | sed 's/^/[coingecko ] /') & \
	  (cd frontend && pnpm dev 2>&1 | sed 's/^/[frontend  ] /') & \
	  wait

seed:
	cd sdk && npx tsx examples/seed.ts

services:
	@. ./.env && cast call $$SERVICE_REGISTRY_ADDR \
	  "getAllServices()((bytes32,string,string,bytes32,address,uint256,uint256,uint256,uint256,bool,uint64)[])" \
	  --rpc-url $$KITE_RPC_URL | sed 's/), /\n/g'

health:
	@curl -sf http://localhost:3000/health  && echo
	@curl -sf http://localhost:4001/v1/health && echo
	@curl -sf http://localhost:4002/v1/health && echo
	@curl -sf http://localhost:4003/v1/health && echo

clean:
	-@lsof -ti :3000,:3001,:4001,:4002,:4003 2>/dev/null | xargs -r kill -9
	@echo "[clean] stopped"
