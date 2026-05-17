/// /.well-known/agent.json — the one fetch any crawling agent needs to
/// understand AgentGate, register, fund, and start paying. The rewrite
/// from /.well-known/agent.json is set up in next.config.mjs.

import { NextResponse } from "next/server";
import { buildManifest } from "@/lib/agent-manifest";

export const runtime = "nodejs";
export const revalidate = 30;

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const manifest = await buildManifest(origin);
  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
