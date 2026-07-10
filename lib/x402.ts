// Server-side paywall for Next.js route handlers using Circle Gateway
// nanopayments (x402 batched settlement). Wrap any handler with withGateway()
// to require a gasless USDC payment before the handler runs.
//
// Pattern mirrors Circle's official arc-nanopayments reference.

import { NextRequest, NextResponse } from "next/server";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";

const SELLER_ADDRESS = process.env.SELLER_ADDRESS as `0x${string}`;

// One shared middleware instance (verifies signatures, queues batch settlement)
const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
});

type Handler = (req: NextRequest) => Promise<NextResponse> | NextResponse;

/**
 * Wrap a route handler so it requires a USDC nanopayment.
 * @param handler  the actual route logic (runs only after payment verifies)
 * @param price    price string, e.g. "$0.01"
 * @param resource the route path, e.g. "/api/analyze"
 */
export function withGateway(handler: Handler, price: string, resource: string) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Ask the Gateway middleware to verify the payment signature on this request.
    const check = await gateway.verify(req, { price, resource });

    if (!check.ok) {
      // No / invalid payment: return 402 with the payment instructions Circle
      // Gateway produced, so the client SDK knows exactly what to sign.
      return NextResponse.json(check.body ?? { error: "Payment Required" }, {
        status: 402,
        headers: check.headers ?? {},
      });
    }

    // Payment verified (offchain, instant) — run the real handler.
    return handler(req);
  };
}
