/// Canonical x402 v2 wire types. These mirror the Python x402 library's
/// pydantic models exactly (alias_generator=to_camel, by_alias=True) so the
/// SDK can speak directly to any Pieverse / Coinbase-compatible facilitator
/// without a translation layer.

export interface PaymentRequirements {
  scheme: "exact";
  network: string; // CAIP-2 (e.g. "eip155:2368")
  asset: string;
  amount: string; // smallest-unit decimal string
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
}

export interface PaymentRequired {
  x402Version: 2;
  error?: string;
  resource?: { url: string; description?: string; mimeType?: string };
  accepts: PaymentRequirements[];
}

export interface Eip3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

export interface PaymentPayload {
  x402Version: 2;
  payload: { signature: string; authorization: Eip3009Authorization };
  accepted: PaymentRequirements;
}
