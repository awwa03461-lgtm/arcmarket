"use client";

import { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { MARKET_ABI, ERC20_ABI } from "@/lib/abis";
import { USDC_ADDRESS, USDC_DECIMALS, MarketState } from "@/lib/chain";
import { MarketInfo, useOutcomeNames } from "@/lib/useMarkets";

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

const COLORS = ["#16c784", "#ea3943", "#f0a020", "#2775CA"];

export function ResolveControl({ market }: { market: MarketInfo }) {
  const { isConnected } = useAccount();
  const names = useOutcomeNames(market);
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);

  const now = Math.floor(Date.now() / 1000);
  const closed = now >= Number(market.closeTime);

  async function propose(outcome: number) {
    if (!isConnected) {
      (window as any).Telegram?.WebApp?.showAlert?.("Connect wallet first");
      return;
    }
    setBusy(true);
    try {
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [market.address, parseUnits("5", USDC_DECIMALS)],
      });
      await new Promise((r) => setTimeout(r, 2500));

      await writeContractAsync({
        address: market.address,
        abi: MARKET_ABI,
        functionName: "assertOutcome",
        args: [BigInt(outcome)],
      });
      haptic("success");
      (window as any).Telegram?.WebApp?.showAlert?.(
        "Outcome proposed! 2-hour challenge period started."
      );
    } catch (e: any) {
      haptic("error");
      (window as any).Telegram?.WebApp?.showAlert?.("Error: " + (e?.shortMessage || e?.message));
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    setBusy(true);
    try {
      await writeContractAsync({
        address: market.address,
        abi: MARKET_ABI,
        functionName: "settleOutcome",
      });
      haptic("success");
      (window as any).Telegram?.WebApp?.showAlert?.("Market resolved!");
    } catch (e: any) {
      haptic("error");
      (window as any).Telegram?.WebApp?.showAlert?.(
        "Error: " + (e?.shortMessage || e?.message) + " (challenge period may not be over yet)"
      );
    } finally {
      setBusy(false);
    }
  }

  if (market.state === MarketState.Resolved) return null;

  if (market.state === MarketState.Asserted) {
    return (
      <div className="glass mt-2 p-3">
        <div className="text-xs text-white/50">
          Outcome proposed. 2-hour challenge period in progress (UMA Optimistic Oracle).
        </div>
        <button
          onClick={settle}
          disabled={busy}
          className="mt-2 w-full rounded-xl bg-usdc py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "..." : "Finalize result"}
        </button>
      </div>
    );
  }

  if (market.state === MarketState.Open && closed) {
    return (
      <div className="glass mt-2 p-3">
        <div className="text-xs text-white/50">
          Market closed. Propose the winning outcome (requires ~1 USDC bond, returned if correct):
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {market.prices.map((_, i) => (
            <button
              key={i}
              onClick={() => propose(i)}
              disabled={busy}
              className="rounded-xl py-2 text-sm font-semibold disabled:opacity-40"
              style={{ background: COLORS[i % 4] + "22", color: COLORS[i % 4] }}
            >
              {names[i] || "outcome " + (i + 1)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
