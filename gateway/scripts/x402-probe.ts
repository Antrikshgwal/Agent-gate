

import * as path from "node:path";
import * as dotenv from "dotenv";
import {
  Wallet,
  JsonRpcProvider,
  Contract,
  TypedDataEncoder,
  hexlify,
  randomBytes,
  parseUnits,
  AbiCoder,
} from "ethers";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const RPC = need("KITE_RPC_URL");
const CHAIN_ID = parseInt(process.env.KITE_CHAIN_ID ?? "2368", 10);
const FACILITATOR = process.env.KITE_FACILITATOR_URL ?? "https://facilitator.pieverse.io";
const NETWORK = process.env.KITE_FACILITATOR_NETWORK ?? `eip155:${process.env.KITE_CHAIN_ID ?? "2368"}`;
const USDC = need("USDC_ADDR");
const PAYER_PK = need("PRIVATE_KEY"); // using deployer as test payer
const PAYEE = need("GATEWAY_WALLET_ADDRESS");

const USDC_ABI = [
  "function name() view returns (string)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function balanceOf(address) view returns (uint256)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
];

async function findEip712Domain(
  provider: JsonRpcProvider,
): Promise<{ name: string; version: string }> {
  const usdc = new Contract(USDC, USDC_ABI, provider);
  const onChainSep: string = await usdc.DOMAIN_SEPARATOR();
  const tokenName: string = await usdc.name();

  // Try every common version string with the on-chain name. First match wins.
  for (const version of ["1", "2", "1.0", "2.0"]) {
    const candidate = TypedDataEncoder.hashDomain({
      name: tokenName,
      version,
      chainId: CHAIN_ID,
      verifyingContract: USDC,
    });
    if (candidate.toLowerCase() === onChainSep.toLowerCase()) {
      console.log(`[domain] match: name="${tokenName}" version="${version}"`);
      return { name: tokenName, version };
    }
  }

  // Try a few additional name variants (some forks change the EIP-712 name).
  for (const name of ["USDC", "USD Coin", "USD//C", "USD Coin (USDC)"]) {
    for (const version of ["1", "2", "1.0", "2.0"]) {
      const candidate = TypedDataEncoder.hashDomain({
        name,
        version,
        chainId: CHAIN_ID,
        verifyingContract: USDC,
      });
      if (candidate.toLowerCase() === onChainSep.toLowerCase()) {
        console.log(`[domain] match: name="${name}" version="${version}"`);
        return { name, version };
      }
    }
  }

  throw new Error(
    `Could not match EIP-712 domain. On-chain DOMAIN_SEPARATOR=${onChainSep}, token name="${tokenName}". ` +
      `Tried versions 1,2,1.0,2.0 and a few name variants.`,
  );
}

async function main() {
  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  const payer = new Wallet(PAYER_PK, provider);

  console.log("[setup]", { CHAIN_ID, USDC, payer: payer.address, payee: PAYEE });

  const { name, version } = await findEip712Domain(provider);

  // Construct the EIP-3009 TransferWithAuthorization payload.
  const value = parseUnits("0.0102", 6); // 0.0102 USDC matches the gateway's 402 quote
  const validAfter = 0n;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 min
  const nonce = hexlify(randomBytes(32));

  const domain = {
    name,
    version,
    chainId: CHAIN_ID,
    verifyingContract: USDC,
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
  } as const;
  const message = {
    from: payer.address,
    to: PAYEE,
    value,
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await payer.signTypedData(domain, types, message);
  console.log("[sign] signature ok, length", signature.length);

  // Build a settlement envelope and shotgun it at /v2/settle in several
  // candidate shapes until the facilitator gives us a non-validation-error.
  const authorization = {
    from: payer.address,
    to: PAYEE,
    value: value.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
  };

  // Canonical v2 PaymentPayload: includes `accepted` (full PaymentRequirements).
  // Reverse-engineered from the official Python x402 library:
  // x402/schemas/payments.py + x402/mechanisms/evm/types.py.
  const accepted = {
    scheme: "exact",
    network: NETWORK,
    asset: USDC,
    amount: value.toString(),
    payTo: PAYEE,
    maxTimeoutSeconds: 600,
    extra: { name, version },
  };
  const paymentPayload = {
    x402Version: 2,
    payload: { signature, authorization },
    accepted,
  };

  // paymentRequirements at top level mirrors paymentPayload.accepted.
  const paymentRequirements = { ...accepted };

  // CAIP-19 candidate for asset
  const caip19Asset = `${NETWORK}/erc20:${USDC}`;
  const altReq = { ...paymentRequirements, asset: caip19Asset };

  const body = { x402Version: 2, paymentPayload, paymentRequirements };

  console.log("\n[verify] POST /v2/verify");
  const vr = await fetch(`${FACILITATOR}/v2/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(`  HTTP ${vr.status}: ${(await vr.text()).slice(0, 400)}`);

  console.log("\n[settle] POST /v2/settle");
  const sr = await fetch(`${FACILITATOR}/v2/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(`  HTTP ${sr.status}: ${(await sr.text()).slice(0, 600)}`);
  return;

  // (legacy candidate sweep below; unreachable)
  const _legacy: Array<{ label: string; body: unknown }> = [
    {
      label: "FINAL: x402Version + paymentPayload(with accepted) + paymentRequirements",
      body: { x402Version: 2, paymentPayload, paymentRequirements },
    },
    {
      label: "I: kind inside paymentPayload",
      body: {
        paymentPayload: {
          ...paymentPayload,
          kind: { x402Version: 2, scheme: "exact", network: NETWORK },
        },
        paymentRequirements,
      },
    },
    {
      label: "J: kind inside paymentRequirements",
      body: {
        paymentPayload,
        paymentRequirements: {
          ...paymentRequirements,
          kind: { x402Version: 2, scheme: "exact", network: NETWORK },
        },
      },
    },
    {
      label: "K: JSON-RPC style",
      body: {
        jsonrpc: "2.0",
        method: "verify",
        id: 1,
        params: { paymentPayload, paymentRequirements },
      },
    },
    {
      label: "L: empty paymentRequirements (see what defaults the facilitator wants)",
      body: { paymentPayload, paymentRequirements: {} },
    },
    {
      label: "M: paymentPayload with NO 'payload' (just top-level fields)",
      body: {
        paymentPayload: {
          x402Version: 2,
          scheme: "exact",
          network: NETWORK,
          signature,
          authorization,
        },
        paymentRequirements,
      },
    },
    {
      label: "A: snake_case top-level keys",
      body: { payment_payload: paymentPayload, payment_requirements: paymentRequirements },
    },
    {
      label: "B: asset as CAIP-19 (eip155:2368/erc20:0x...)",
      body: { paymentPayload, paymentRequirements: altReq },
    },
    {
      label: "C: payTo lowercased",
      body: {
        paymentPayload,
        paymentRequirements: { ...paymentRequirements, payTo: PAYEE.toLowerCase() },
      },
    },
    {
      label: "D: drop 'extra' from requirements (let facilitator infer)",
      body: { paymentPayload, paymentRequirements: { ...paymentRequirements, extra: undefined } },
    },
    {
      label: "E: payload.authorization fields snake_case (valid_after / valid_before)",
      body: {
        paymentPayload: {
          ...paymentPayload,
          payload: {
            signature,
            authorization: {
              from: payer.address,
              to: PAYEE,
              value: value.toString(),
              valid_after: validAfter.toString(),
              valid_before: validBefore.toString(),
              nonce,
            },
          },
        },
        paymentRequirements,
      },
    },
    {
      label: "F: include chainId numeric separately",
      body: {
        paymentPayload: { ...paymentPayload, chainId: CHAIN_ID },
        paymentRequirements: { ...paymentRequirements, chainId: CHAIN_ID },
      },
    },
    {
      label: "G: x402Version inside requirements too",
      body: {
        paymentPayload,
        paymentRequirements: { ...paymentRequirements, x402Version: 2 },
      },
    },
  ];

  for (const c of _legacy) {
    void c;
  }

  void AbiCoder; // keep import for future expansion
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
