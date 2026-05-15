/// Minimal AgentGate provider skeleton.
///
/// Speaks the gateway↔provider RPC contract documented in
/// providers/README.md. Fork this file, replace the `dispatch` body with
/// your real upstream calls, and you have a working provider.

import express, { type Request, type Response } from "express";
import * as crypto from "node:crypto";
import * as dotenv from "dotenv";

dotenv.config();

const PORT = parseInt(process.env.PORT ?? "4001", 10);
const SECRET = process.env.AGENTGATE_GATEWAY_SECRET ?? "";

if (!SECRET) {
  console.warn(
    "[provider] AGENTGATE_GATEWAY_SECRET is empty — all /v1/call requests will be rejected.",
  );
}

/// What this provider advertises. Update the name + methods in your fork.
const SERVICE_NAME = "Template";
const SUPPORTED_METHODS = ["echo"] as const;
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
  // Constant-time compare so timing attacks can't leak the secret.
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
    return res
      .status(400)
      .json({ success: false, data: null, error: "method is required" } satisfies CallResponse);
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
    case "echo":
      // Stand-in for a real upstream call. Replace with your API integration.
      return { echoed: params, at: new Date().toISOString() };
  }
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
