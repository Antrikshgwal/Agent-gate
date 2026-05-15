/// AgentGate OpenWeather provider.
///
/// Stands behind the gateway as the actual holder of the OpenWeather API
/// key. Speaks the gateway↔provider RPC contract documented in
/// providers/README.md.

import express, { type Request, type Response } from "express";
import * as crypto from "node:crypto";
import * as dotenv from "dotenv";

dotenv.config();

const PORT = parseInt(process.env.PORT ?? "4001", 10);
const SECRET = process.env.AGENTGATE_GATEWAY_SECRET ?? "";
const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY ?? "";

if (!SECRET) {
  console.warn("[openweather] AGENTGATE_GATEWAY_SECRET is empty — all calls will be rejected.");
}
if (!OPENWEATHER_KEY) {
  console.warn("[openweather] OPENWEATHER_API_KEY is empty — upstream calls will fail.");
}

const SERVICE_NAME = "OpenWeather";
const SUPPORTED_METHODS = ["get_current_weather", "get_forecast"] as const;
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
    case "get_current_weather":
      return getCurrentWeather(params);
    case "get_forecast":
      return getForecast(params);
  }
}

async function getCurrentWeather(params: Record<string, unknown>): Promise<unknown> {
  const city = typeof params.city === "string" ? params.city : null;
  if (!city) throw new Error("Missing required parameter: city");

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", city);
  url.searchParams.set("appid", OPENWEATHER_KEY);
  url.searchParams.set("units", typeof params.units === "string" ? params.units : "metric");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `OpenWeather returned HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    main?: { temp?: number; humidity?: number; pressure?: number };
    weather?: Array<{ description?: string }>;
    wind?: { speed?: number };
  };
  return {
    city,
    temperature: data.main?.temp,
    description: data.weather?.[0]?.description,
    humidity: data.main?.humidity,
    pressure: data.main?.pressure,
    wind_speed: data.wind?.speed,
  };
}

async function getForecast(params: Record<string, unknown>): Promise<unknown> {
  const city = typeof params.city === "string" ? params.city : null;
  if (!city) throw new Error("Missing required parameter: city");

  const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
  url.searchParams.set("q", city);
  url.searchParams.set("appid", OPENWEATHER_KEY);
  url.searchParams.set("units", typeof params.units === "string" ? params.units : "metric");
  url.searchParams.set("cnt", "8");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `OpenWeather forecast returned HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    list?: Array<{
      dt_txt?: string;
      main?: { temp?: number };
      weather?: Array<{ description?: string }>;
    }>;
  };
  return {
    city,
    forecast: (data.list ?? []).map((p) => ({
      time: p.dt_txt,
      temperature: p.main?.temp,
      description: p.weather?.[0]?.description,
    })),
  };
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
