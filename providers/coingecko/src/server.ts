/// AgentGate CoinGecko provider.
///
/// Resells the public CoinGecko v3 API. No API key required — the
/// provider exists as a demonstration that AgentGate can route to any
/// upstream the operator wants, not just keyed services.

import express, { type Request, type Response } from "express";
import * as crypto from "node:crypto";
import * as dotenv from "dotenv";

dotenv.config();

const PORT = parseInt(process.env.PORT ?? "4003", 10);
const SECRET = process.env.AGENTGATE_GATEWAY_SECRET ?? "";
const BASE = "https://api.coingecko.com/api/v3";

if (!SECRET) {
  console.warn("[coingecko] AGENTGATE_GATEWAY_SECRET is empty — all calls will be rejected.");
}

const SERVICE_NAME = "CoinGecko";
const SUPPORTED_METHODS = ["get_price", "get_market_chart"] as const;
type Method = (typeof SUPPORTED_METHODS)[number];

interface CallBody {
  method?: string;
  params?: Record<string, unknown>;
}

interface CallResponse {
  success: boolean;
  data: unknown;
  error: string | null;
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/v1/health", (_req, res) => {
  res.json({ ok: true, name: SERVICE_NAME, methods: SUPPORTED_METHODS });
});

app.post("/v1/call", async (req: Request, res: Response) => {
  const presented = String(req.header("x-agentgate-auth") ?? "");
  if (!constantTimeEquals(presented, SECRET)) {
    return res.status(401).json({
      success: false,
      data: null,
      error: "unauthorized",
    } satisfies CallResponse);
  }

  const { method, params } = (req.body ?? {}) as CallBody;
  if (!method) {
    return res.status(400).json({
      success: false,
      data: null,
      error: "method is required",
    } satisfies CallResponse);
  }
  if (!SUPPORTED_METHODS.includes(method as Method)) {
    return res.status(200).json({
      success: false,
      data: null,
      error: `unsupported method: ${method}`,
    } satisfies CallResponse);
  }

  try {
    const data = await dispatch(method as Method, params ?? {});
    return res.json({ success: true, data, error: null } satisfies CallResponse);
  } catch (err) {
    return res.json({
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    } satisfies CallResponse);
  }
});

async function dispatch(method: Method, params: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    case "get_price":
      return getPrice(params);
    case "get_market_chart":
      return getMarketChart(params);
  }
}

async function getPrice(params: Record<string, unknown>): Promise<unknown> {
  const ids = stringParam(params, "ids");
  const vs = stringParam(params, "vs_currencies") ?? "usd";
  if (!ids) throw new Error("Missing required parameter: ids (e.g. 'bitcoin,ethereum')");

  const url = new URL(`${BASE}/simple/price`);
  url.searchParams.set("ids", ids);
  url.searchParams.set("vs_currencies", vs);

  const r = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `CoinGecko returned HTTP ${r.status}`);
  }
  return await r.json();
}

async function getMarketChart(params: Record<string, unknown>): Promise<unknown> {
  const id = stringParam(params, "id");
  const days = stringParam(params, "days") ?? "1";
  const vs = stringParam(params, "vs_currency") ?? "usd";
  if (!id) throw new Error("Missing required parameter: id (e.g. 'bitcoin')");

  const url = new URL(`${BASE}/coins/${encodeURIComponent(id)}/market_chart`);
  url.searchParams.set("vs_currency", vs);
  url.searchParams.set("days", days);

  const r = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `CoinGecko returned HTTP ${r.status}`);
  }
  const data = (await r.json()) as {
    prices?: Array<[number, number]>;
    market_caps?: Array<[number, number]>;
  };
  // Trim to the latest 24 points for response-size sanity.
  return {
    id,
    vs_currency: vs,
    days,
    prices: (data.prices ?? []).slice(-24),
    market_caps: (data.market_caps ?? []).slice(-24),
  };
}

function stringParam(p: Record<string, unknown>, key: string): string | null {
  const v = p[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

app.listen(PORT, () => {
  console.log(
    `[provider:${SERVICE_NAME}] listening on http://localhost:${PORT} (methods: ${SUPPORTED_METHODS.join(", ")})`,
  );
});
