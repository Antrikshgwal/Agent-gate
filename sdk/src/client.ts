import { Wallet, JsonRpcProvider } from "ethers";
import {
  chainIdFromCaip2,
  decodePaymentRequired,
  encodePaymentSignature,
  signAuthorization,
} from "./sign.js";
import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
} from "./types.js";

export interface AgentGateClientOptions {
  gatewayUrl: string; // e.g. "http://localhost:3000"
  privateKey: string; // payer key (signs EIP-3009 authorizations)
  rpcUrl?: string; // optional; required only for on-chain reads
  agentDID: string; // bytes32 hex of the agent's DID in AgentRegistry
}

export interface CallRequest {
  serviceId: string; // bytes32 hex of the service in ServiceRegistry
  method: string;
  params?: Record<string, unknown>;
  /// Hard cap on the amount of USDC we're willing to spend on this call,
  /// expressed in smallest unit (e.g. 50_000n = 0.05 USDC). The SDK will
  /// refuse to sign if the gateway quotes more.
  maxAmount?: bigint;
}

export interface CallResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  payment?: {
    transaction: string;
    network: string;
    amount: string;
    attestation_tx_hash: string | null;
  };
  latency_ms?: number;
}

export class PaymentTooHighError extends Error {
  constructor(public quoted: bigint, public cap: bigint) {
    super(`Gateway quoted ${quoted} but client cap is ${cap}`);
  }
}

export class AgentGateClient {
  private readonly wallet: Wallet;

  constructor(private readonly opts: AgentGateClientOptions) {
    const provider = opts.rpcUrl ? new JsonRpcProvider(opts.rpcUrl) : undefined;
    this.wallet = new Wallet(opts.privateKey, provider);
  }

  get payer(): string {
    return this.wallet.address;
  }

  /// Make a paid call to the AgentGate gateway.
  ///
  /// Flow:
  ///   1. POST /api/v1/call (no payment) → expect HTTP 402.
  ///   2. Read PAYMENT-REQUIRED header, pick the first accept entry.
  ///   3. Sign an EIP-3009 authorization for that requirement.
  ///   4. POST again with the signed PaymentPayload in PAYMENT-SIGNATURE.
  ///   5. Return the gateway's response (which includes the attestation tx).
  async call<T = unknown>(req: CallRequest): Promise<CallResponse<T>> {
    const url = `${this.opts.gatewayUrl}/api/v1/call`;
    const bodyJson = JSON.stringify({
      service_id: req.serviceId,
      agent_did: this.opts.agentDID,
      method: req.method,
      params: req.params ?? {},
    });

    // Step 1: ask for a quote.
    const quoteRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyJson,
    });
    if (quoteRes.status !== 402) {
      // Unexpected — surface the body for debugging.
      throw new Error(`Expected HTTP 402, got ${quoteRes.status}: ${await quoteRes.text()}`);
    }

    const headerRaw = quoteRes.headers.get("payment-required");
    const required: PaymentRequired = headerRaw
      ? decodePaymentRequired(headerRaw)
      : ((await quoteRes.json()) as PaymentRequired);
    const requirements: PaymentRequirements = required.accepts[0]!;

    if (req.maxAmount !== undefined && BigInt(requirements.amount) > req.maxAmount) {
      throw new PaymentTooHighError(BigInt(requirements.amount), req.maxAmount);
    }

    // Step 2: sign the EIP-3009 authorization for that requirement.
    const chainId = chainIdFromCaip2(requirements.network);
    const { signature, authorization } = await signAuthorization(
      this.wallet,
      chainId,
      requirements,
    );

    const paymentPayload: PaymentPayload = {
      x402Version: 2,
      payload: { signature, authorization },
      accepted: requirements,
    };

    // Step 3: retry with PAYMENT-SIGNATURE.
    const paidRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-SIGNATURE": encodePaymentSignature(paymentPayload),
      },
      body: bodyJson,
    });
    const body = await paidRes.json().catch(() => ({}));
    return body as CallResponse<T>;
  }
}
