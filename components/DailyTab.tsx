"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { formatUnits } from "viem";
import { DAILY_ADDRESS, DAILY_ABI } from "@/lib/daily";

const HERMES = "https://hermes.pyth.network";

// Side enum in the contract: 0 = None, 1 = Above, 2 = Below
const NONE = 0, ABOVE = 1, BELOW = 2;

const ACCENT: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#14f195",
};

type Q = {
  feedId: `0x${string}`;
  symbol: string;
  target: bigint;   // 1e8-scaled
  aboveVotes: bigint;
  belowVotes: bigint;
  result: number;
};

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n < 10 ? 4 : 0,
  });
}

function useCountdown(closeTime: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, closeTime - Math.floor(Date.now() / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [closeTime]);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return { left, label: h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s` };
}

export function DailyTab() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  // --- current round id
  const { data: roundId } = useReadContract({
    address: DAILY_ADDRESS,
    abi: DAILY_ABI,
    functionName: "currentRound",
    query: { refetchInterval: 30000 },
  });
  const rid = roundId ? Number(roundId) : 0;

  // --- round info
  const { data: round, refetch: refetchRound } = useReadContract({
    address: DAILY_ADDRESS,
    abi: DAILY_ABI,
    functionName: "getRound",
    args: rid ? [BigInt(rid)] : undefined,
    query: { enabled: rid > 0, refetchInterval: 20000 },
  });

  // --- the three questions
  const q0 = useReadContract({
    address: DAILY_ADDRESS, abi: DAILY_ABI, functionName: "getQuestion",
    args: rid ? [BigInt(rid), 0n] : undefined,
    query: { enabled: rid > 0, refetchInterval: 20000 },
  });
  const q1 = useReadContract({
    address: DAILY_ADDRESS, abi: DAILY_ABI, functionName: "getQuestion",
    args: rid ? [BigInt(rid), 1n] : undefined,
    query: { enabled: rid > 0, refetchInterval: 20000 },
  });
  const q2 = useReadContract({
    address: DAILY_ADDRESS, abi: DAILY_ABI, functionName: "getQuestion",
    args: rid ? [BigInt(rid), 2n] : undefined,
    query: { enabled: rid > 0, refetchInterval: 20000 },
  });

  const raw = [q0.data, q1.data, q2.data];
  const questions: Q[] = raw
    .filter(Boolean)
    .map((d: any) => ({
      feedId: d[0],
      symbol: d[1],
      target: d[2],
      aboveVotes: d[3],
      belowVotes: d[4],
      result: Number(d[5]),
    }));

  // --- my votes
  const { data: myVotes, refetch: refetchVotes } = useReadContract({
    address: DAILY_ADDRESS,
    abi: DAILY_ABI,
    functionName: "getVotes",
    args: rid && address ? [BigInt(rid), address] : undefined,
    query: { enabled: rid > 0 && !!address, refetchInterval: 15000 },
  });
  const votes: number[] = myVotes ? (myVotes as unknown as any[]).map(Number) : [0, 0, 0];

  // --- am I a winner?
  const { data: winner } = useReadContract({
    address: DAILY_ADDRESS,
    abi: DAILY_ABI,
    functionName: "isWinner",
    args: rid && address ? [BigInt(rid), address] : undefined,
    query: { enabled: rid > 0 && !!address },
  });

  const { data: didClaim, refetch: refetchClaim } = useReadContract({
    address: DAILY_ADDRESS,
    abi: DAILY_ABI,
    functionName: "claimed",
    args: rid && address ? [BigInt(rid), address] : undefined,
    query: { enabled: rid > 0 && !!address },
  });

  const closeTime = round ? Number((round as any)[1]) : 0;
  const prizePool = round ? Number(formatUnits((round as any)[2] as bigint, 6)) : 0;
  const settled = round ? Boolean((round as any)[3]) : false;
  const winnerCount = round ? Number((round as any)[4]) : 0;
  const perWinner = round ? Number(formatUnits((round as any)[5] as bigint, 6)) : 0;

  const { left, label: countdown } = useCountdown(closeTime);
  const votingOpen = left > 0 && !settled;

  // --- live prices from Hermes (off-chain, free, no gas)
  const pullPrices = useCallback(async () => {
    if (!questions.length) return;
    try {
      const ids = questions.map((q) => q.feedId).join("&ids[]=");
      const r = await fetch(`${HERMES}/v2/updates/price/latest?ids[]=${ids}`);
      if (!r.ok) return;
      const d = await r.json();
      const next: Record<string, number> = {};
      (d.parsed || []).forEach((p: any) => {
        const price = Number(p.price.price) * Math.pow(10, p.price.expo);
        const feed = "0x" + p.id;
        const q = questions.find(
          (x) => x.feedId.toLowerCase() === feed.toLowerCase()
        );
        if (q) next[q.symbol] = price;
      });
      setLivePrices(next);
    } catch {
      /* live price is a nice-to-have; ignore failures */
    }
  }, [questions.map((q) => q.feedId).join(",")]);

  useEffect(() => {
    pullPrices();
    const id = setInterval(pullPrices, 10000);
    return () => clearInterval(id);
  }, [pullPrices]);

  async function castVote(qIndex: number, side: number) {
    if (!address) return;
    setBusy(qIndex);
    setErr("");
    try {
      const hash = await writeContractAsync({
        address: DAILY_ADDRESS,
        abi: DAILY_ABI,
        functionName: "vote",
        args: [BigInt(rid), qIndex, side],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      haptic("success");
      refetchVotes();
      q0.refetch(); q1.refetch(); q2.refetch();
    } catch (e: any) {
      haptic("error");
      setErr(e?.shortMessage || e?.message || "Vote failed");
    } finally {
      setBusy(null);
    }
  }

  async function claimPrize() {
    if (!address) return;
    setBusy(99);
    setErr("");
    try {
      const hash = await writeContractAsync({
        address: DAILY_ADDRESS,
        abi: DAILY_ABI,
        functionName: "claim",
        args: [BigInt(rid)],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      haptic("success");
      refetchClaim();
      refetchRound();
    } catch (e: any) {
      haptic("error");
      setErr(e?.shortMessage || e?.message || "Claim failed");
    } finally {
      setBusy(null);
    }
  }

  if (!isConnected) {
    return (
      <div className="glass p-8 text-center">
        <div className="text-4xl">🎯</div>
        <h3 className="mt-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Daily Predictions
        </h3>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
          Connect your wallet to play. Free to enter — you only pay gas.
        </p>
      </div>
    );
  }

  if (!rid || !round) {
    return (
      <div className="glass p-8 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
        No round open yet. Check back soon!
      </div>
    );
  }

  const votedAll = votes.every((v) => v !== NONE);

  return (
    <div className="space-y-3">
      {/* ---------- header ---------- */}
      <div className="glass p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs" style={{ color: "var(--ink-dim)" }}>
              Round #{rid} · Prize pool
            </div>
            <div className="num text-2xl font-bold" style={{ color: "var(--usdc)" }}>
              {prizePool.toFixed(0)} USDC
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs" style={{ color: "var(--ink-dim)" }}>
              {settled ? "Settled" : votingOpen ? "Closes in" : "Awaiting settlement"}
            </div>
            <div className="num text-lg font-semibold" style={{ color: "var(--ink)" }}>
              {settled ? "✓" : countdown}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
          Get <b>all three</b> right and split the pool with the other perfect
          scorers. Free to enter — you only pay gas. Settled trustlessly by Pyth.
        </p>
      </div>

      {/* ---------- winner banner ---------- */}
      {settled && winner && !didClaim && (
        <div className="glass p-4 text-center" style={{ border: "1.5px solid var(--yes)" }}>
          <div className="text-2xl">🎉</div>
          <div className="mt-1 font-semibold" style={{ color: "var(--ink)" }}>
            You got all three right!
          </div>
          <div className="num mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
            Your share: <b style={{ color: "var(--usdc)" }}>{perWinner.toFixed(2)} USDC</b>
            {" · "}{winnerCount} winner{winnerCount === 1 ? "" : "s"}
          </div>
          <button
            onClick={claimPrize}
            disabled={busy === 99}
            className="mt-3 w-full rounded-2xl py-3 font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--yes)" }}
          >
            {busy === 99 ? "Claiming..." : "Claim your prize"}
          </button>
        </div>
      )}

      {settled && didClaim && (
        <div className="glass p-3 text-center text-sm" style={{ color: "var(--yes)" }}>
          ✓ Prize claimed. See you tomorrow!
        </div>
      )}

      {settled && !winner && votedAll && (
        <div className="glass p-3 text-center text-xs" style={{ color: "var(--ink-dim)" }}>
          Not a perfect score this time. {winnerCount} player
          {winnerCount === 1 ? "" : "s"} got all three. Try again tomorrow!
        </div>
      )}

      {/* ---------- the three questions ---------- */}
      {questions.map((q, i) => {
        const target = Number(q.target) / 1e8;
        const live = livePrices[q.symbol];
        const myVote = votes[i];
        const total = Number(q.aboveVotes) + Number(q.belowVotes);
        const abovePct = total ? Math.round((Number(q.aboveVotes) / total) * 100) : 50;
        const accent = ACCENT[q.symbol] || "var(--usdc)";
        const diff = live ? ((live - target) / target) * 100 : 0;
        const correct = q.result !== NONE ? q.result : null;

        return (
          <div key={i} className="glass p-4">
            {/* symbol + live price */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: accent }}
                />
                <span className="font-semibold" style={{ color: "var(--ink)" }}>
                  {q.symbol}/USD
                </span>
              </div>
              {live ? (
                <div className="text-right">
                  <div className="num text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {fmtUsd(live)}
                  </div>
                  <div
                    className="num text-[10px]"
                    style={{ color: diff >= 0 ? "var(--yes)" : "var(--no)" }}
                  >
                    {diff >= 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(2)}% vs target
                  </div>
                </div>
              ) : (
                <span className="text-[10px]" style={{ color: "var(--ink-dim)" }}>
                  loading price...
                </span>
              )}
            </div>

            {/* question */}
            <div className="mt-3 text-sm font-medium" style={{ color: "var(--ink)" }}>
              Will {q.symbol} close above{" "}
              <span className="num" style={{ color: accent }}>{fmtUsd(target)}</span>?
            </div>

            {/* result (after settlement) */}
            {correct && (
              <div
                className="mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: correct === ABOVE ? "#16b88622" : "#ea394322",
                  color: correct === ABOVE ? "var(--yes)" : "var(--no)",
                }}
              >
                Result: {correct === ABOVE ? "ABOVE ↑" : "BELOW ↓"}
                {myVote !== NONE && (myVote === correct ? " · you were right ✓" : " · you missed ✗")}
              </div>
            )}

            {/* vote buttons / my vote */}
            {!settled && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => castVote(i, ABOVE)}
                  disabled={!votingOpen || myVote !== NONE || busy !== null}
                  className="rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
                  style={
                    myVote === ABOVE
                      ? { background: "var(--yes)", color: "#fff" }
                      : { background: "#16b88618", color: "var(--yes)" }
                  }
                >
                  {busy === i ? "..." : "↑ Above"}
                </button>
                <button
                  onClick={() => castVote(i, BELOW)}
                  disabled={!votingOpen || myVote !== NONE || busy !== null}
                  className="rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
                  style={
                    myVote === BELOW
                      ? { background: "var(--no)", color: "#fff" }
                      : { background: "#ea394318", color: "var(--no)" }
                  }
                >
                  {busy === i ? "..." : "↓ Below"}
                </button>
              </div>
            )}

            {/* crowd sentiment — only revealed AFTER you vote, to avoid herding */}
            {myVote !== NONE ? (
              <div className="mt-3">
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: "var(--yes)" }}>{abovePct}% above</span>
                  <span style={{ color: "var(--ink-dim)" }}>{total} votes</span>
                  <span style={{ color: "var(--no)" }}>{100 - abovePct}% below</span>
                </div>
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--no)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${abovePct}%`, background: "var(--yes)" }}
                  />
                </div>
              </div>
            ) : (
              votingOpen && (
                <div className="mt-3 text-center text-[10px]" style={{ color: "var(--ink-dim)" }}>
                  Vote to reveal what everyone else thinks
                </div>
              )
            )}
          </div>
        );
      })}

      {err && (
        <div className="glass p-3 text-center text-xs" style={{ color: "var(--no)" }}>
          {err}
        </div>
      )}

      {votingOpen && !votedAll && (
        <div className="glass p-3 text-center text-[11px]" style={{ color: "var(--ink-dim)" }}>
          Answer all three to be eligible for the prize.
        </div>
      )}
    </div>
  );
}
