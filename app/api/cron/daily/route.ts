// Daily cron (Vercel Cron Jobs).
//
// Runs once a day and does two things:
//   1) settles yesterday's round using fresh Pyth data (trustless — the
//      contract reads the on-chain price itself)
//   2) opens today's round: reads live BTC/ETH/SOL prices and sets a target
//      slightly away from spot, so each question is a genuine coin-flip
//
// Protected by CRON_SECRET so only Vercel can trigger it.

import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { DAILY_ABI, FEEDS } from "@/lib/daily";

export const maxDuration = 60;

const RPC = "https://rpc.testnet.arc.network";
const HERMES = "https://hermes.pyth.network";
const USDC = "0x3600000000000000000000000000000000000000" as `0x${string}`;
const DAILY = process.env.NEXT_PUBLIC_DAILY_ADDRESS as `0x${string}`;
const PRIZE_USDC = process.env.DAILY_PRIZE || "10"; // per round

// how far the target sits from spot (as a fraction). 0.3% keeps it close to a
// coin flip over a single day while still being a real call.
const TARGET_OFFSET = 0.003;

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
} as const;

const ERC20_APPROVE = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const publicClient = createPublicClient({
  chain: arcTestnet as any,
  transport: http(RPC),
});

function getWallet() {
  const account = privateKeyToAccount(
    process.env.OPERATOR_PRIVATE_KEY as `0x${string}`
  );
  return createWalletClient({
    account,
    chain: arcTestnet as any,
    transport: http(RPC),
  });
}

/** latest prices + the binary update blobs Pyth needs on-chain */
async function fetchPyth(ids: string[]) {
  const qs = ids.map((i) => `ids[]=${i}`).join("&");
  const res = await fetch(`${HERMES}/v2/updates/price/latest?${qs}`);
  if (!res.ok) throw new Error("Hermes failed: " + res.status);
  const data = await res.json();

  const prices: Record<string, number> = {};
  for (const p of data.parsed || []) {
    prices["0x" + p.id] = Number(p.price.price) * Math.pow(10, p.price.expo);
  }
  const updateData: `0x${string}`[] = (data.binary?.data || []).map(
    (h: string) => ("0x" + h) as `0x${string}`
  );
  return { prices, updateData };
}

export async function GET(req: NextRequest) {
  // only Vercel Cron (or someone with the secret) may run this
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallet = getWallet();
  const log: string[] = [];

  try {
    const feedIds = [FEEDS.BTC, FEEDS.ETH, FEEDS.SOL];
    const { prices, updateData } = await fetchPyth(feedIds);

    // ---------- 1) settle the previous round, if it's due ----------
    const current = (await publicClient.readContract({
      address: DAILY,
      abi: DAILY_ABI,
      functionName: "currentRound",
    })) as bigint;

    if (current > 0n) {
      const r: any = await publicClient.readContract({
        address: DAILY,
        abi: DAILY_ABI,
        functionName: "getRound",
        args: [current],
      });
      const closeTime = Number(r[1]);
      const settled = Boolean(r[3]);
      const now = Math.floor(Date.now() / 1000);

      if (!settled && now >= closeTime) {
        const fee = await publicClient.readContract({
          address: DAILY,
          abi: [
            {
              type: "function",
              name: "pyth",
              stateMutability: "view",
              inputs: [],
              outputs: [{ type: "address" }],
            },
          ] as const,
          functionName: "pyth",
        });
        // ask Pyth what the update costs
        const pythFee = (await publicClient.readContract({
          address: fee as `0x${string}`,
          abi: [
            {
              type: "function",
              name: "getUpdateFee",
              stateMutability: "view",
              inputs: [{ name: "updateData", type: "bytes[]" }],
              outputs: [{ type: "uint256" }],
            },
          ] as const,
          functionName: "getUpdateFee",
          args: [updateData],
        })) as bigint;

        const hash = await wallet.writeContract({
          address: DAILY,
          abi: DAILY_ABI,
          functionName: "settle",
          args: [current, updateData],
          value: pythFee,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        log.push(`settled round ${current} (tx ${hash})`);
      } else {
        log.push(`round ${current} not due for settlement yet`);
      }
    }

    // ---------- 2) open today's round ----------
    const symbols = ["BTC", "ETH", "SOL"] as const;
    const targets = feedIds.map((id, i) => {
      const spot = prices[id.toLowerCase()] ?? prices[id];
      if (!spot) throw new Error("no price for " + symbols[i]);
      // alternate above/below spot so questions aren't all one-directional
      const dir = i % 2 === 0 ? 1 : -1;
      const target = spot * (1 + dir * TARGET_OFFSET);
      return BigInt(Math.round(target * 1e8)); // Pyth's 1e8 convention
    });

    // close at the next UTC midnight
    const now = new Date();
    const close = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
    );
    const closeTime = BigInt(Math.floor(close.getTime() / 1000));

    const prize = parseUnits(PRIZE_USDC, 6);

    // approve the prize transfer, then open the round
    const approveHash = await wallet.writeContract({
      address: USDC,
      abi: ERC20_APPROVE,
      functionName: "approve",
      args: [DAILY, prize],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    const openHash = await wallet.writeContract({
      address: DAILY,
      abi: DAILY_ABI,
      functionName: "openRound",
      args: [
        feedIds as any,
        symbols as any,
        targets as any,
        closeTime,
        prize,
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash: openHash });

    log.push(`opened new round (tx ${openHash})`);
    log.push(
      `targets: ${symbols
        .map((s, i) => `${s} $${(Number(targets[i]) / 1e8).toFixed(2)}`)
        .join(", ")}`
    );

    return NextResponse.json({ ok: true, log });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e).slice(0, 400), log },
      { status: 500 }
    );
  }
}
