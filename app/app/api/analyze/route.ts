// Paid endpoint: given a prediction-market question, returns an unbiased,
// research-backed briefing. Gated behind a Circle Gateway nanopayment.
//
// IMPORTANT: this returns *context and factors*, never betting advice.

import { NextRequest, NextResponse } from "next/server";
import { withGateway } from "@/lib/x402";

const GROQ_API_KEY = process.env.GROQ_API_KEY!;

// System prompt is deliberately constrained: inform, never advise.
const SYSTEM_PROMPT = `You are a neutral research assistant for a prediction market.
Given a market question, produce a SHORT, balanced briefing that helps a person
reason for themselves. You MUST:
- Give relevant, up-to-date context and known facts.
- List a few factors that point toward YES and a few toward NO.
- Stay strictly neutral. NEVER tell the user which side to bet, never predict the
  outcome, never imply a "correct" answer or express confidence in one side.
- End with one line: "This is context, not betting advice."
Keep it under 180 words. Use plain language.`;

async function handler(req: NextRequest): Promise<NextResponse> {
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

  // Groq Compound model runs web search + reasoning in one call.
  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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

  if (!groqRes.ok) {
    const t = await groqRes.text();
    return NextResponse.json(
      { error: "Analysis failed", detail: t.slice(0, 200) },
      { status: 502 }
    );
  }

  const data = await groqRes.json();
  const analysis =
    data.choices?.[0]?.message?.content?.trim() || "No analysis produced.";

  return NextResponse.json({
    question,
    analysis,
    generatedAt: new Date().toISOString(),
    disclaimer: "Informational only. Not financial or betting advice.",
  });
}

// $0.01 per analysis, paid gaslessly via Circle Gateway.
export const POST = withGateway(handler, "$0.01", "/api/analyze");
