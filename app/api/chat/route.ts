// AI Chat API — gated behind a one-time 1 USDC payment on Arc,
// with a 5-questions-per-day limit per wallet.
//
// Storage: Upstash Redis (via Vercel Marketplace)
//   paid:<address>            -> "1" once the wallet's payment tx is verified
//   quota:<address>:<YYYYMMDD> -> number of questions used today (TTL 48h)

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createPublicClient, http, getAddress } from "viem";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const TREASURY = "0x2326464c8d8EEF23A9Ae30B27CEa4Aa8F831b626".toLowerCase();
const USDC = "0x3600000000000000000000000000000000000000" as `0x${string}`;
const PRICE = 1_000_000n; // 1 USDC (6 decimals)
const DAILY_LIMIT = 5;

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
} as const;

const client = createPublicClient({
  chain: arcTestnet as any,
  transport: http("https://rpc.testnet.arc.network"),
});

function todayKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

const SYSTEM_PROMPT = `You are Arc Assistant, a helpful AI inside a prediction-market app on Arc (Circle's stablecoin blockchain).
Be concise, friendly, and genuinely useful. You can discuss anything, but you're especially good at crypto, prediction markets, and Arc/USDC topics.
If asked which outcome to bet on, explain the factors both ways but never tell someone what to bet — that's their call.`;

// ---- verify the user's 1 USDC payment on-chain ----
// We decode the Transfer logs directly from the tx receipt (no extra getLogs
// call, which can be flaky on Arc's RPC).
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function topicToAddress(topic: string): string {
  // a 32-byte topic holds a left-padded 20-byte address
  return ("0x" + topic.slice(-40)).toLowerCase();
}

async function verifyPayment(
  address: string,
  txHash: string
): Promise<{ ok: boolean; reason?: string }> {
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
  } catch (e: any) {
    return { ok: false, reason: "Transaction not found yet" };
  }

  if (receipt.status !== "success") {
    return { ok: false, reason: "Transaction failed on-chain" };
  }

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USDC.toLowerCase()) continue;
    if (!log.topics || log.topics.length < 3) continue;
    if ((log.topics[0] || "").toLowerCase() !== TRANSFER_TOPIC) continue;

    const from = topicToAddress(log.topics[1] as string);
    const to = topicToAddress(log.topics[2] as string);
    const value = BigInt(log.data);

    if (
      from === address.toLowerCase() &&
      to === TREASURY &&
      value >= PRICE
    ) {
      return { ok: true };
    }
  }
  return {
    ok: false,
    reason: "No 1 USDC transfer to the treasury found in this transaction",
  };
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { action, address, txHash, messages } = body || {};
  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }
  const addr = getAddress(address).toLowerCase();

  // ---------- action: status ----------
  if (action === "status") {
    const paid = await redis.get<string>(`paid:${addr}`);
    const used = (await redis.get<number>(`quota:${addr}:${todayKey()}`)) || 0;
    return NextResponse.json({
      paid: paid === "1",
      used,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - used),
    });
  }

  // ---------- action: activate (verify the payment tx) ----------
  if (action === "activate") {
    if (!txHash) {
      return NextResponse.json({ error: "Missing txHash" }, { status: 400 });
    }
    const already = await redis.get<string>(`paid:${addr}`);
    if (already === "1") {
      return NextResponse.json({ paid: true, message: "Already active" });
    }
    // prevent one tx being reused by several wallets
    const txUsed = await redis.get<string>(`tx:${txHash.toLowerCase()}`);
    if (txUsed) {
      return NextResponse.json(
        { error: "This transaction was already used" },
        { status: 400 }
      );
    }
    const result = await verifyPayment(addr, txHash);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason || "Payment not verified" },
        { status: 402 }
      );
    }
    await redis.set(`paid:${addr}`, "1");
    await redis.set(`tx:${txHash.toLowerCase()}`, addr);
    return NextResponse.json({ paid: true, message: "Chat activated!" });
  }

  // ---------- action: chat ----------
  if (action === "chat") {
    const paid = await redis.get<string>(`paid:${addr}`);
    if (paid !== "1") {
      return NextResponse.json(
        { error: "Not activated. Pay 1 USDC to unlock chat." },
        { status: 402 }
      );
    }

    const qKey = `quota:${addr}:${todayKey()}`;
    const used = (await redis.get<number>(qKey)) || 0;
    if (used >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: `Daily limit reached (${DAILY_LIMIT}/day). Come back tomorrow.` },
        { status: 429 }
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages" }, { status: 400 });
    }

    // call Groq
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + GROQ_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-10).map((m: any) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: String(m.content).slice(0, 2000),
          })),
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!groqRes.ok) {
      const t = await groqRes.text();
      return NextResponse.json(
        { error: "AI failed", detail: t.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = await groqRes.json();
    const reply =
      data.choices?.[0]?.message?.content?.trim() || "Sorry, no response.";

    // count this question (TTL 48h so it self-cleans)
    const newUsed = used + 1;
    await redis.set(qKey, newUsed, { ex: 172800 });

    return NextResponse.json({
      reply,
      used: newUsed,
      remaining: Math.max(0, DAILY_LIMIT - newUsed),
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
