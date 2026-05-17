/// Server-side "agent" endpoint for the /playground page.
///
/// The browser posts a serviceId + method + params; we replay the same x402
/// dance the SDK does (quote → sign EIP-3009 → settle) using a demo agent key
/// loaded from the server env. Returns the raw gateway response plus a
/// timeline the UI can render step-by-step.

import { NextResponse } from "next/server";
import { Wallet, hexlify, randomBytes } from "ethers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RunRequest {
  serviceId: string;
  method: string;
  params: Record<string, unknown>;
}

interface TimelineStep {
  label: string;
  ms: number;
  detail?: string;
}

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing server env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const timeline: TimelineStep[] = [];
  const mark = (label: string, detail?: string) => {
    timeline.push({ label, ms: Date.now() - t0, detail });
  };

  try {
    const body = (await req.json()) as RunRequest;
    if (!body.serviceId || !body.method) {
      return NextResponse.json(
        { error: "serviceId and method are required" },
        { status: 400 },
      );
    }

    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3000";
    const privateKey = need("DEMO_AGENT_PRIVATE_KEY");
    const agentDID = need("DEMO_AGENT_DID");

    const wallet = new Wallet(privateKey);
    mark("Agent wallet loaded", wallet.address);

    const url = `${gatewayUrl}/api/v1/call`;
    const bodyJson = JSON.stringify({
      service_id: body.serviceId,
      agent_did: agentDID,
      method: body.method,
      params: body.params ?? {},
    });

    // Step 1: ask for a quote (expect 402).
    const quoteRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyJson,
    });
    if (quoteRes.status !== 402) {
      const text = await quoteRes.text();
      return NextResponse.json(
        { error: `Expected 402, got ${quoteRes.status}`, body: text, timeline },
        { status: 502 },
      );
    }
    mark("Received HTTP 402 quote");

    const headerRaw = quoteRes.headers.get("payment-required");
    const required = headerRaw
      ? JSON.parse(Buffer.from(headerRaw, "base64").toString("utf-8"))
      : await quoteRes.json();
    const requirements = required.accepts[0];
    mark(
      "Quote decoded",
      `${(Number(requirements.amount) / 1_000_000).toFixed(6)} USDC → ${requirements.payTo.slice(0, 10)}…`,
    );

    // Step 2: sign EIP-3009.
    const chainIdMatch = /^eip155:(\d+)$/.exec(requirements.network);
    if (!chainIdMatch) throw new Error(`Bad network: ${requirements.network}`);
    const chainId = parseInt(chainIdMatch[1]!, 10);

    const now = Math.floor(Date.now() / 1000);
    const authorization = {
      from: await wallet.getAddress(),
      to: requirements.payTo,
      value: requirements.amount,
      validAfter: "0",
      validBefore: String(now + 600),
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
    mark("EIP-3009 authorization signed");

    const paymentPayload = {
      x402Version: 2,
      payload: { signature, authorization },
      accepted: requirements,
    };
    const sigHeader = Buffer.from(JSON.stringify(paymentPayload), "utf-8").toString("base64");

    // Step 3: settle + execute.
    const paidRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-SIGNATURE": sigHeader,
      },
      body: bodyJson,
    });
    const result = await paidRes.json().catch(() => ({}));
    mark("Gateway settled + forwarded + distributed");

    return NextResponse.json({
      ok: true,
      agent: wallet.address,
      amountMicroUsdc: requirements.amount,
      payTo: requirements.payTo,
      result,
      timeline,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        timeline,
      },
      { status: 500 },
    );
  }
}
