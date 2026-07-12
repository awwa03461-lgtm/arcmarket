// AI Market Analysis endpoint (Arc + Circle Nanopayments + Groq).
//
// Architecture (Path A — autonomous agent):
//   1. A buyer agent (server-side wallet) pays $0.01 USDC via Circle Gateway
//      nanopayments — gasless, settled in batches.
//   2. Groq (with web search) produces a NEUTRAL market briefing.
//   3. The briefing is returned to the user.
//
// The user just taps "Analyze"; the agent handles payment behind the scenes.

import { NextRequest, NextResponse } from "next/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const BUYER_PRIVATE_KEY = process.env.BUYER_PRIVATE_KEY as `0x${string}`;
const SELLER_ADDRESS = process.env.SELLER_ADDRESS as `0x${string}`;

const SYSTEM_PROMPT = `You are a neutral research assistant for a prediction market.
Given a market question, produce a SHORT, balanced briefing that helps a person
reason for themselves. You MUST:
- Give relevant, up-to-date context and known facts.
- List a few factors pointing toward YES and a few toward NO.
- Stay strictly neutral. NEVER tell the user which side to bet, never predict the
  outcome, never imply a "correct" answer or express confidence in one side.
- End with exactly: "This is context, not betting advice."
Keep it under 180 words. Plain language.`;

// One shared buyer agent (holds a small USDC balance in Circle Gateway).
let gatewayClient: GatewayClient | null = null;
function getClient() {
  if (!gatewayClient) {
    gatewayClient = new GatewayClient({
      chain: "arcTestnet",
      privateKey: BUYER_PRIVATE_KEY,
    });
  }
  return gatewayClient;
}

async function runGroq(question: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + GROQ_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "groq/compound",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Market question: " + question },
      ],
      temperature: 0.4,
      max_tokens: 500,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Groq failed: " + t.slice(0, 160));
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "No analysis produced.";
}

export async function POST(req: NextRequest) {
  let question = "";
  try {
    const body = await req.json();
    question = (body.question || "").toString().slice(0, 300);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!question.trim()) {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }

  // 1) Agent pays $0.01 for this analysis via Circle Gateway (gasless).
  let paid = false;
  let paymentTx: string | undefined;
  try {
    const client = getClient();
    const origin = req.nextUrl.origin;
    // Pay the paywalled "premium" resource. The seller records the revenue.
    const payRes = await client.pay(origin + "/api/paid/analyze");
    paid = true;
    paymentTx = (payRes as any)?.paymentResponse?.transaction;
  } catch (e: any) {
    // If payment fails, we still don't want to hard-block the demo, but we do
    // surface it so you can see whether nanopayments settled.
    return NextResponse.json(
      { error: "Nanopayment failed", detail: (e?.message || "").slice(0, 200) },
      { status: 402 },
    );
  }

  // 2) Produce the neutral analysis.
  try {
    const analysis = await runGroq(question);
    return NextResponse.json({
      question,
      analysis,
      paid,
      paymentTx,
      generatedAt: new Date().toISOString(),
      disclaimer: "Informational only. Not financial or betting advice.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Analysis failed", detail: (e?.message || "").slice(0, 200) },
      { status: 502 },
    );
  }
}
