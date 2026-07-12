// AI Chat API — gated behind a one-time 1 USDC payment on Arc,
// with a 5-questions-per-day limit per wallet (shared across all conversations).
//
// Storage (Upstash Redis):
//   paid:<addr>                 -> "yes" once the payment tx is verified
//   tx:<txHash>                 -> addr (prevents reusing one tx)
//   quota:<addr>:<YYYYMMDD>     -> questions used today (TTL 48h)
//   convs:<addr>                -> [{ id, title, updatedAt }]  (conversation list)
//   conv:<addr>:<id>            -> Msg[]  (messages of one conversation)

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
const MAX_MSGS = 100;   // per conversation
const MAX_CONVS = 30;   // per wallet

type Msg = { role: "user" | "assistant"; content: string };
type ConvMeta = { id: string; title: string; updatedAt: number };

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

function makeTitle(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 40 ? t.slice(0, 40) + "..." : t || "New chat";
}

const SYSTEM_PROMPT = `You are Arc Assistant, a helpful AI inside a prediction-market app on Arc (Circle's stablecoin blockchain).
Be concise, friendly, and genuinely useful. You can discuss anything, but you're especially good at crypto, prediction markets, and Arc/USDC topics.
If asked which outcome to bet on, explain the factors both ways but never tell someone what to bet — that's their call.`;

// ---- verify the user's 1 USDC payment on-chain ----
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function topicToAddress(topic: string): string {
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
  } catch {
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
    if (from === address.toLowerCase() && to === TREASURY && value >= PRICE) {
      return { ok: true };
    }
  }
  return {
    ok: false,
    reason: "No 1 USDC transfer to the treasury found in this transaction",
  };
}

// ---- helpers ----
async function getConvs(addr: string): Promise<ConvMeta[]> {
  const list = (await redis.get(`convs:${addr}`)) as ConvMeta[] | null;
  return Array.isArray(list) ? list : [];
}

async function saveConvs(addr: string, list: ConvMeta[]) {
  await redis.set(`convs:${addr}`, list.slice(0, MAX_CONVS));
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { action, address, txHash, messages, convId, title } = body || {};
  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }
  const addr = getAddress(address).toLowerCase();

  // ---------- debug ----------
  if (action === "debug") {
    try {
      await redis.set("healthcheck", "ok", { ex: 60 });
      const health = await redis.get("healthcheck");
      const paid = await redis.get(`paid:${addr}`);
      return NextResponse.json({
        redisWorking: !!health,
        paidValue: paid,
        addr,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        hasRedisUrl: !!process.env.KV_REST_API_URL,
        hasRedisToken: !!process.env.KV_REST_API_TOKEN,
      });
    } catch (e: any) {
      return NextResponse.json({
        redisWorking: false,
        error: String(e?.message || e).slice(0, 300),
      });
    }
  }

  // ---------- status: paid? quota? conversation list? ----------
  if (action === "status") {
    const paid = await redis.get(`paid:${addr}`);
    const used = Number(await redis.get(`quota:${addr}:${todayKey()}`)) || 0;
    const convs = await getConvs(addr);
    return NextResponse.json({
      paid: !!paid,
      used,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - used),
      convs,
    });
  }

  // ---------- activate ----------
  if (action === "activate") {
    if (!txHash) {
      return NextResponse.json({ error: "Missing txHash" }, { status: 400 });
    }
    const already = await redis.get(`paid:${addr}`);
    if (already) {
      return NextResponse.json({ paid: true, message: "Already active" });
    }
    const txUsed = await redis.get(`tx:${String(txHash).toLowerCase()}`);
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
    await redis.set(`paid:${addr}`, "yes");
    await redis.set(`tx:${String(txHash).toLowerCase()}`, addr);
    return NextResponse.json({ paid: true, message: "Chat activated!" });
  }

  // ---------- load one conversation ----------
  if (action === "load") {
    if (!convId) {
      return NextResponse.json({ error: "Missing convId" }, { status: 400 });
    }
    const msgs = (await redis.get(`conv:${addr}:${convId}`)) as Msg[] | null;
    return NextResponse.json({ messages: Array.isArray(msgs) ? msgs : [] });
  }

  // ---------- delete one conversation ----------
  if (action === "delete") {
    if (!convId) {
      return NextResponse.json({ error: "Missing convId" }, { status: 400 });
    }
    await redis.del(`conv:${addr}:${convId}`);
    const convs = await getConvs(addr);
    await saveConvs(addr, convs.filter((c) => c.id !== convId));
    return NextResponse.json({ ok: true, convs: await getConvs(addr) });
  }

  // ---------- rename a conversation ----------
  if (action === "rename") {
    if (!convId || !title) {
      return NextResponse.json({ error: "Missing convId/title" }, { status: 400 });
    }
    const convs = await getConvs(addr);
    const next = convs.map((c) =>
      c.id === convId ? { ...c, title: makeTitle(String(title)) } : c
    );
    await saveConvs(addr, next);
    return NextResponse.json({ ok: true, convs: next });
  }

  // ---------- chat ----------
  if (action === "chat") {
    const paid = await redis.get(`paid:${addr}`);
    if (!paid) {
      return NextResponse.json(
        { error: "Not activated. Pay 1 USDC to unlock chat." },
        { status: 402 }
      );
    }

    // shared daily quota across ALL conversations
    const qKey = `quota:${addr}:${todayKey()}`;
    const used = Number(await redis.get(qKey)) || 0;
    if (used >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: `Daily limit reached (${DAILY_LIMIT}/day). Come back tomorrow.` },
        { status: 429 }
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages" }, { status: 400 });
    }
    if (!convId) {
      return NextResponse.json({ error: "Missing convId" }, { status: 400 });
    }

    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
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
      }
    );

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

    // count the question (shared quota)
    const newUsed = used + 1;
    await redis.set(qKey, newUsed, { ex: 172800 });

    // persist this conversation's transcript
    const transcript: Msg[] = [
      ...messages.map((m: any) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: String(m.content),
      })),
      { role: "assistant" as const, content: reply },
    ].slice(-MAX_MSGS);
    await redis.set(`conv:${addr}:${convId}`, transcript);

    // upsert its metadata, newest first
    const convs = await getConvs(addr);
    const firstUser = messages.find((m: any) => m.role === "user");
    const existing = convs.find((c) => c.id === convId);
    const meta: ConvMeta = {
      id: convId,
      title: existing?.title || makeTitle(firstUser?.content || "New chat"),
      updatedAt: Date.now(),
    };
    const next = [meta, ...convs.filter((c) => c.id !== convId)];
    await saveConvs(addr, next);

    return NextResponse.json({
      reply,
      used: newUsed,
      remaining: Math.max(0, DAILY_LIMIT - newUsed),
      convs: next.slice(0, MAX_CONVS),
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
