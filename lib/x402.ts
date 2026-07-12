// Server-side paywall using Circle's official x402-batching facilitator.
// Wrap a Next.js route handler with withGateway() to require a gasless USDC
// nanopayment (verified + settled by Circle Gateway on Arc Testnet).
//
// Adapted from Circle's official arc-nanopayments lib/x402.ts,
// with the Supabase payment-logging removed (not needed here).

import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import { NextRequest, NextResponse } from "next/server";

const ARC_TESTNET_NETWORK = "eip155:5042002";
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
const ARC_TESTNET_GATEWAY_WALLET =
  "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

export const sellerAddress = process.env.SELLER_ADDRESS as `0x${string}`;

const facilitator = new BatchFacilitatorClient();

interface PaymentPayload {
  x402Version: number;
  resource?: { url: string; description: string; mimeType: string };
  accepted?: Record<string, unknown>;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

function buildPaymentRequirements(price: string) {
  const amount = Math.round(parseFloat(price.replace("$", "")) * 1_000_000);
  return {
    scheme: "exact" as const,
    network: ARC_TESTNET_NETWORK,
    asset: ARC_TESTNET_USDC,
    amount: amount.toString(),
    payTo: sellerAddress,
    maxTimeoutSeconds: 345600,
    extra: {
      name: "GatewayWalletBatched",
      version: "1",
      verifyingContract: ARC_TESTNET_GATEWAY_WALLET,
    },
  };
}

export function withGateway(
  handler: (req: NextRequest) => Promise<NextResponse>,
  price: string,
  endpoint: string,
) {
  const requirements = buildPaymentRequirements(price);

  return async (req: NextRequest) => {
    const paymentSignature = req.headers.get("payment-signature");

    // No payment — return 402 with Gateway batching payment requirements
    if (!paymentSignature) {
      const paymentRequired = {
        x402Version: 2,
        resource: {
          url: endpoint,
          description: `Paid resource (${price} USDC)`,
          mimeType: "application/json",
        },
        accepts: [requirements],
      };
      return new NextResponse(JSON.stringify({}), {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "PAYMENT-REQUIRED": Buffer.from(
            JSON.stringify(paymentRequired),
          ).toString("base64"),
        },
      });
    }

    // Payment present — verify + settle via Circle Gateway
    try {
      const paymentPayload: PaymentPayload = JSON.parse(
        Buffer.from(paymentSignature, "base64").toString("utf-8"),
      );

      const verifyResult = await facilitator.verify(paymentPayload, requirements);
      if (!verifyResult.isValid) {
        return NextResponse.json(
          { error: "Payment verification failed", reason: verifyResult.invalidReason },
          { status: 402 },
        );
      }

      const settleResult = await facilitator.settle(paymentPayload, requirements);
      if (!settleResult.success) {
        return NextResponse.json(
          { error: "Payment settlement failed", reason: settleResult.errorReason },
          { status: 402 },
        );
      }

      // Payment OK — run the real handler
      const response = await handler(req);

      const settleResponseHeader = Buffer.from(
        JSON.stringify({
          success: true,
          transaction: settleResult.transaction,
          network: requirements.network,
          payer: settleResult.payer ?? verifyResult.payer ?? "unknown",
        }),
      ).toString("base64");
      response.headers.set("PAYMENT-RESPONSE", settleResponseHeader);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: "Payment processing error", message },
        { status: 500 },
      );
    }
  };
}
