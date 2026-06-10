"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContracts } from "wagmi";
import { MARKET_ABI, ERC20_ABI } from "@/lib/abis";
import { MarketInfo, useOutcomeNames } from "@/lib/useMarkets";
import { MarketState } from "@/lib/chain";

const COLORS = ["#2dd4a7", "#f25e7a", "#f5b14c", "#4d8dff"];

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

function fmt(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n) / 10n ** 16n;
  return `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}

function MarketPositions({ market }: { market: MarketInfo }) {
  const { address } = useAccount();
  const names = useOutcomeNames(market);
  const { writeContractAsync } = useWriteContract();

  const tokenContracts = Array.from({ length: market.outcomeCount }, (_, i) => ({
    address: market.address,
    abi: MARKET_ABI,
    functionName: "getOutcomeToken",
    args: [BigInt(i)],
  }));
  const { data: tokenAddrs } = useReadContracts({
    contracts: tokenContracts as any,
    query: { enabled: market.outcomeCount > 0 },
  });

  const balContracts =
    tokenAddrs && address
      ? tokenAddrs.map((t) => ({
          address: (t.result as `0x${string}`) ?? "0x0000000000000000000000000000000000000000",
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }))
      : [];
  const { data: bals } = useReadContracts({
    contracts: balContracts as any,
    query: { enabled: balContracts.length > 0, refetchInterval: 8000 },
  });

  if (!bals) return null;
  const shares = bals.map((b) => (b.result as bigint | undefined) ?? 0n);
  const hasAny = shares.some((s) => s > 0n);
  if (!hasAny) return null;

  const resolved = market.state === MarketState.Resolved;
  const won = resolved && shares[market.winningOutcome] > 0n;

  async function redeem() {
    try {
      await writeContractAsync({
        address: market.address,
        abi: MARKET_ABI,
        functionName: "redeem",
      });
      haptic("success");
      (window as any).Telegram?.WebApp?.showAlert?.("Winnings claimed!");
    } catch (e: any) {
      haptic("error");
      (window as any).Telegram?.WebApp?.showAlert?.("Error: " + (e?.shortMessage || e?.message));
    }
  }

  async function sell(i: number, amount: bigint) {
    try {
      await writeContractAsync({
        address: market.address,
        abi: MARKET_ABI,
        functionName: "sell",
        args: [BigInt(i), amount, 0n],
      });
      haptic("success");
      (window as any).Telegram?.WebApp?.showAlert?.("Sold!");
    } catch (e: any) {
      haptic("error");
      (window as any).Telegram?.WebApp?.showAlert?.("Error: " + (e?.shortMessage || e?.message));
    }
  }

  return (
    <div className="glass p-4">
      <div className="text-sm font-medium leading-snug" style={{ color: "var(--ink)" }}>
        {market.question}
      </div>
      <div className="mt-3 space-y-2">
        {shares.map((s, i) =>
          s > 0n ? (
            <div key={i} className="flex items-center justify-between">
              <span className="num text-sm" style={{ color: COLORS[i % 4] }}>
                {names[i] || `Outcome ${i + 1}`}: {fmt(s)}
              </span>
              {!resolved && (
                <button
                  onClick={() => sell(i, s)}
                  className="rounded-lg px-3 py-1 text-xs"
                  style={{ background: "var(--surface-2)", color: "var(--ink)" }}
                >
                  Sell
                </button>
              )}
            </div>
          ) : null
        )}
      </div>
      {won && (
        <button
          onClick={redeem}
          className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold"
          style={{ background: "var(--yes)", color: "#04241b" }}
        >
          Claim winnings
        </button>
      )}
      {resolved && !won && (
        <div className="mt-2 text-xs" style={{ color: "var(--no)" }}>Position lost</div>
      )}
    </div>
  );
}

export function Portfolio({ markets }: { markets: MarketInfo[] }) {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  if (!isConnected)
    return (
      <div className="glass p-6 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
        Connect your wallet to see positions
      </div>
    );
  if (markets.length === 0)
    return (
      <div className="glass p-6 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
        No positions yet.
      </div>
    );

  return (
    <div className="space-y-3">
      {markets.map((m) => (
        <MarketPositions key={m.address} market={m} />
      ))}
    </div>
  );
}
