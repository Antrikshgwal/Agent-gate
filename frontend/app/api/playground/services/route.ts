/// Lite service list for the playground page: just the fields the form needs,
/// stringified for JSON transport.

import { NextResponse } from "next/server";
import { getAllServices } from "@/lib/data";

export const runtime = "nodejs";
export const revalidate = 15;

export async function GET() {
  try {
    const all = await getAllServices();
    const services = all
      .filter((s) => s.isActive)
      .map((s) => ({
        id: s.id,
        name: s.name,
        endpoint: s.endpoint,
        provider: s.provider,
        pricePerCall: s.pricePerCall.toString(),
        totalCalls: s.totalCalls.toString(),
        successfulCalls: s.successfulCalls.toString(),
      }));
    return NextResponse.json({ services });
  } catch (err) {
    return NextResponse.json(
      { services: [], error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
