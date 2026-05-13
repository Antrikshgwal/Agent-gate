import { Wallet, hexlify, randomBytes } from "ethers";
import type { Eip3009Authorization, PaymentRequirements } from "./types.js";

/// Sign an EIP-3009 TransferWithAuthorization message authorizing the
/// facilitator to move `requirements.amount` of the asset from the wallet to
/// `requirements.payTo`. Returns the signature + the canonical authorization.
export async function signAuthorization(
  wallet: Wallet,
  chainId: number,
  requirements: PaymentRequirements,
  validitySeconds = 600,
): Promise<{ signature: string; authorization: Eip3009Authorization }> {
  const now = Math.floor(Date.now() / 1000);
  const authorization: Eip3009Authorization = {
    from: await wallet.getAddress(),
    to: requirements.payTo,
    value: requirements.amount,
    validAfter: "0",
    validBefore: String(now + validitySeconds),
    nonce: hexlify(randomBytes(32)),
  };

  const domain = {
    name: requirements.extra.name,
    version: requirements.extra.version,
    chainId,
    verifyingContract: requirements.asset,
  };
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };
  const signature = await wallet.signTypedData(domain, types, authorization);
  return { signature, authorization };
}

/// Encode a PaymentPayload as a base64 string suitable for the
/// PAYMENT-SIGNATURE request header.
export function encodePaymentSignature(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
}

/// Decode a base64 PAYMENT-REQUIRED response header.
export function decodePaymentRequired<T>(header: string): T {
  return JSON.parse(Buffer.from(header, "base64").toString("utf-8")) as T;
}

/// Pull chain id from a CAIP-2 network string ("eip155:2368" → 2368).
export function chainIdFromCaip2(network: string): number {
  const m = network.match(/^eip155:(\d+)$/);
  if (!m) throw new Error(`Unsupported network (not eip155): ${network}`);
  return parseInt(m[1]!, 10);
}
