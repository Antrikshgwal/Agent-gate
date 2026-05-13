import { config } from "../config.js";

/// Canonical x402 v2 PaymentRequirements (one entry of a 402's `accepts` list,
/// or the requirements echoed back during verify/settle).
export interface PaymentRequirements {
  scheme: "exact";
  network: string; // CAIP-2 (e.g. "eip155:2368")
  asset: string;
  amount: string; // smallest-unit decimal string
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    name: string; // EIP-712 token name
    version: string; // EIP-712 token version
  };
}

/// Canonical x402 v2 402 envelope (sent in body and `PAYMENT-REQUIRED` header).
export interface PaymentRequired {
  x402Version: 2;
  error?: string;
  resource?: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepts: PaymentRequirements[];
}

/// Canonical x402 v2 PaymentPayload (what the agent submits in PAYMENT-SIGNATURE).
export interface PaymentPayload {
  x402Version: 2;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
  };
  accepted: PaymentRequirements;
}

export interface SettlementResult {
  success: boolean;
  transaction: string;
  network: string;
  payer: string;
  amount?: string;
  errorReason?: string;
  raw: unknown;
}

export class FacilitatorError extends Error {
  constructor(public status: number, public details: unknown) {
    super(`Facilitator failed (HTTP ${status})`);
  }
}

export function decodePaymentSignature(header: string): PaymentPayload {
  const buf = Buffer.from(header, "base64").toString("utf-8");
  return JSON.parse(buf) as PaymentPayload;
}

export function encodePaymentRequired(envelope: PaymentRequired): string {
  return Buffer.from(JSON.stringify(envelope), "utf-8").toString("base64");
}

export async function verify(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<{ isValid: boolean; payer?: string; invalidReason?: string }> {
  const res = await fetch(`${config.kite.facilitatorUrl()}/v2/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      x402Version: 2,
      paymentPayload,
      paymentRequirements,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new FacilitatorError(res.status, body);
  return body as { isValid: boolean; payer?: string; invalidReason?: string };
}

export async function settle(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<SettlementResult> {
  const res = await fetch(`${config.kite.facilitatorUrl()}/v2/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      x402Version: 2,
      paymentPayload,
      paymentRequirements,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new FacilitatorError(res.status, body);
  const r = body as Partial<SettlementResult>;
  return {
    success: r.success ?? false,
    transaction: r.transaction ?? "",
    network: r.network ?? "",
    payer: r.payer ?? "",
    amount: r.amount,
    errorReason: r.errorReason,
    raw: body,
  };
}
