// The paywalled "premium" resource (SELLER side). The buyer agent pays $0.01
// via Circle Gateway to access this. It just confirms access — the actual
// analysis is done by the caller (/api/analyze) after payment settles.
//
// This is what makes the flow a real x402 nanopayment: unpaid -> 402,
// paid -> 200, and the seller's Gateway balance grows.

import { NextRequest, NextResponse } from "next/server";
import { withGateway } from "@/lib/x402";

async function handler(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    resource: "market-analysis",
    grantedAt: new Date().toISOString(),
  });
}

export const GET = withGateway(handler, "$0.01", "/api/paid/analyze");
export const POST = withGateway(handler, "$0.01", "/api/paid/analyze");
