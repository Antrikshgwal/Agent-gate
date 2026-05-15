import { Router } from "express";
import { keccak256, toUtf8Bytes, formatUnits } from "ethers";
import {
  distributeSettlement,
  getServiceById,
  logAttestationOnChain,
} from "../blockchain/contracts.js";
import {
  decodePaymentSignature,
  encodePaymentRequired,
  FacilitatorError,
  settle,
  type PaymentRequired,
  type PaymentRequirements,
} from "../x402/facilitator.js";
import { config } from "../config.js";

export const callRouter = Router();

interface CallBody {
  service_id?: string;
  agent_did?: string;
  method?: string;
  params?: Record<string, unknown>;
}

interface ProviderResponse {
  success: boolean;
  data: unknown;
  error: string | null;
}

callRouter.post("/api/v1/call", async (req, res) => {
  const { service_id, agent_did, method, params } = (req.body ?? {}) as CallBody;

  const paymentSignature =
    pickHeader(req.headers["payment-signature"]) ?? pickHeader(req.headers["x-payment"]);

  if (!service_id || !agent_did || !method) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      message: "service_id, agent_did, and method are required",
    });
  }

  // 1. Resolve service on-chain.
  const service = await getServiceById(service_id).catch((err) => {
    res.status(500).json({
      error: "BLOCKCHAIN_READ_FAILED",
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  });
  if (res.writableEnded) return;
  if (!service) {
    return res.status(404).json({
      error: "SERVICE_NOT_FOUND",
      message: `No service registered with id ${service_id}`,
    });
  }
  if (!service.isActive) {
    return res.status(410).json({
      error: "SERVICE_INACTIVE",
      message: `Service ${service.name} has been deactivated`,
    });
  }
  if (!service.endpoint) {
    return res.status(503).json({
      error: "SERVICE_ENDPOINT_MISSING",
      message: `Service ${service.name} has no endpoint registered`,
    });
  }

  // pricePerCall is the gross amount; PaymentSplitter fans it 95/5.
  // payTo is the splitter so settlement lands in a contract we control.
  const total = service.pricePerCall;
  const requirements: PaymentRequirements = {
    scheme: "exact",
    network: config.kite.facilitatorNetwork(),
    asset: config.contracts.usdc(),
    amount: total.toString(),
    payTo: config.contracts.paymentSplitter(),
    maxTimeoutSeconds: 600,
    extra: { name: "USD Coin", version: "1" },
  };

  // 2. No payment → 402.
  if (!paymentSignature) {
    const envelope: PaymentRequired = {
      x402Version: 2,
      error: "Payment required",
      resource: {
        url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        description: `${service.name} call`,
        mimeType: "application/json",
      },
      accepts: [requirements],
    };
    res.setHeader("PAYMENT-REQUIRED", encodePaymentRequired(envelope));
    res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
    return res.status(402).json(envelope);
  }

  // 3. Decode + settle via Pieverse.
  let paymentPayload;
  try {
    paymentPayload = decodePaymentSignature(paymentSignature);
  } catch {
    return res.status(400).json({
      error: "INVALID_PAYMENT_SIGNATURE",
      message: "PAYMENT-SIGNATURE header is not valid base64 JSON",
    });
  }

  let settlement;
  try {
    settlement = await settle(paymentPayload, requirements);
    if (!settlement.success) {
      return res.status(402).json({
        success: false,
        error: "PAYMENT_SETTLEMENT_FAILED",
        details: settlement.errorReason ?? settlement.raw,
      });
    }
  } catch (err) {
    if (err instanceof FacilitatorError) {
      return res.status(402).json({
        success: false,
        error: "PAYMENT_SETTLEMENT_FAILED",
        details: err.details,
      });
    }
    return res.status(500).json({
      success: false,
      error: "PAYMENT_PROCESSING_ERROR",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // 4. Forward to the provider's HTTP endpoint.
  const forwardStart = Date.now();
  const forwarded = await forwardToProvider({
    endpoint: service.endpoint,
    method,
    params: params ?? {},
    agentDID: agent_did,
  });
  const latencyMs = Date.now() - forwardStart;

  // 5. Fan settlement out to provider (95%) and protocol (5%).
  let distributionTxHash: string | null = null;
  try {
    distributionTxHash = await distributeSettlement(service.id, total);
  } catch (err) {
    console.error("[splitter] distribute failed:", err);
  }

  // 6. Persist attestation. Best-effort.
  const paymentHash = settlement.transaction
    ? settlement.transaction
    : keccak256(toUtf8Bytes(JSON.stringify(settlement.raw ?? {})));

  let attestationTxHash: string | null = null;
  try {
    attestationTxHash = await logAttestationOnChain({
      serviceId: service.id,
      agentDID: agent_did,
      amountPaid: total,
      x402PaymentHash: ensureBytes32(paymentHash),
      success: forwarded.success,
      latencyMs,
    });
  } catch (err) {
    console.error("[attestation] log failed:", err);
  }

  res.setHeader(
    "PAYMENT-RESPONSE",
    Buffer.from(
      JSON.stringify({
        success: true,
        transaction: settlement.transaction,
        network: settlement.network,
        payer: settlement.payer,
        amount: formatUnits(total, 6),
        distribution: distributionTxHash,
        attestation: attestationTxHash,
      }),
      "utf-8",
    ).toString("base64"),
  );
  res.setHeader("Access-Control-Expose-Headers", "PAYMENT-RESPONSE");

  res.json({
    success: forwarded.success,
    data: forwarded.data,
    error: forwarded.error,
    payment: {
      transaction: settlement.transaction,
      network: settlement.network,
      amount: formatUnits(total, 6),
      distribution_tx_hash: distributionTxHash,
      attestation_tx_hash: attestationTxHash,
    },
    latency_ms: latencyMs,
  });
});

async function forwardToProvider(args: {
  endpoint: string;
  method: string;
  params: Record<string, unknown>;
  agentDID: string;
}): Promise<ProviderResponse> {
  const url = joinUrl(args.endpoint, "/v1/call");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.gateway.providerCallTimeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agentgate-auth": config.gateway.providerAuthSecret(),
        "x-agentgate-agent-did": args.agentDID,
      },
      body: JSON.stringify({ method: args.method, params: args.params }),
      signal: controller.signal,
    });
    if (!r.ok) {
      return {
        success: false,
        data: null,
        error: `provider returned HTTP ${r.status}`,
      };
    }
    const json = (await r.json()) as Partial<ProviderResponse>;
    return {
      success: Boolean(json.success),
      data: json.data ?? null,
      error: json.error ?? null,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function pickHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function ensureBytes32(input: string): string {
  let hex = input.toLowerCase().startsWith("0x") ? input.slice(2) : input;
  if (hex.length > 64) hex = hex.slice(0, 64);
  if (hex.length < 64) hex = hex.padStart(64, "0");
  return `0x${hex}`;
}
