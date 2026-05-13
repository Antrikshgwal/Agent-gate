import { Router } from "express";
import { keccak256, toUtf8Bytes, formatUnits } from "ethers";
import { getServiceById, logAttestationOnChain } from "../blockchain/contracts.js";
import {
  decodePaymentSignature,
  encodePaymentRequired,
  FacilitatorError,
  settle,
  type PaymentRequired,
  type PaymentRequirements,
} from "../x402/facilitator.js";
import { getAdapter } from "../adapters/registry.js";
import { config } from "../config.js";

export const callRouter = Router();

interface CallBody {
  service_id?: string;
  agent_did?: string;
  method?: string;
  params?: Record<string, unknown>;
}

callRouter.post("/api/v1/call", async (req, res) => {
  const { service_id, agent_did, method, params } = (req.body ?? {}) as CallBody;

  // x402 v2 uses PAYMENT-SIGNATURE. We also accept X-PAYMENT for V1 compatibility.
  const paymentSignature =
    pickHeader(req.headers["payment-signature"]) ?? pickHeader(req.headers["x-payment"]);

  if (!service_id || !agent_did || !method) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      message: "service_id, agent_did, and method are required",
    });
  }

  // 1. Look up the service on-chain (always — both for 402 and for execute).
  const service = await getServiceById(service_id).catch((err) => {
    res.status(500).json({
      error: "BLOCKCHAIN_READ_FAILED",
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  });
  if (!res.writableEnded && !service) {
    return res.status(404).json({
      error: "SERVICE_NOT_FOUND",
      message: `No service registered with id ${service_id}`,
    });
  }
  if (res.writableEnded || !service) return;

  if (!service.isActive) {
    return res.status(410).json({
      error: "SERVICE_INACTIVE",
      message: `Service ${service.name} has been deactivated`,
    });
  }

  // Compute pricing once — used by both 402 and the settled path.
  const serviceFee = service.pricePerCall;
  const gatewayFee = (serviceFee * BigInt(config.gateway.feeBps)) / 10_000n;
  const total = serviceFee + gatewayFee;

  const requirements: PaymentRequirements = {
    scheme: "exact",
    network: config.kite.facilitatorNetwork(),
    asset: config.contracts.usdc(),
    amount: total.toString(),
    payTo: config.gateway.walletAddress(),
    maxTimeoutSeconds: 600,
    extra: { name: "USD Coin", version: "1" },
  };

  // 2. No payment yet → return HTTP 402 with PAYMENT-REQUIRED header + JSON body.
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

  // 3. Decode signed payload + settle with Pieverse facilitator.
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

  // 4. Route to the adapter and execute.
  const adapter = getAdapter(service.name);
  if (!adapter) {
    return res.status(501).json({
      success: false,
      error: "NO_ADAPTER",
      message: `Service "${service.name}" is registered on-chain but no executor is configured`,
    });
  }
  if (!adapter.supportedMethods.includes(method)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_METHOD",
      message: `Method "${method}" is not supported by adapter "${adapter.name}"`,
      supported: adapter.supportedMethods,
    });
  }

  const result = await adapter.execute(method, params ?? {});

  // 5. Persist the attestation. Failure logged but does not 500 the response.
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
      success: result.success,
      latencyMs: result.latencyMs,
    });
  } catch (err) {
    console.error("[attestation] log failed:", err);
  }

  // Echo settlement details in PAYMENT-RESPONSE header (canonical x402 v2).
  res.setHeader(
    "PAYMENT-RESPONSE",
    Buffer.from(
      JSON.stringify({
        success: true,
        transaction: settlement.transaction,
        network: settlement.network,
        payer: settlement.payer,
        amount: formatUnits(total, 6),
        attestation: attestationTxHash,
      }),
      "utf-8",
    ).toString("base64"),
  );
  res.setHeader("Access-Control-Expose-Headers", "PAYMENT-RESPONSE");

  res.json({
    success: result.success,
    data: result.data,
    error: result.error,
    payment: {
      transaction: settlement.transaction,
      network: settlement.network,
      amount: formatUnits(total, 6),
      attestation_tx_hash: attestationTxHash,
    },
    latency_ms: result.latencyMs,
  });
});

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
