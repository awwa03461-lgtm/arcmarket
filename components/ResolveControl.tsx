"use client";

import { useState } from "react";
import { useWriteContract, useAccount, useReadContract } from "wagmi";
import { parseUnits } from "viem";
import { MARKET_ABI, ERC20_ABI, OO_ABI } from "@/lib/abis";
import { USDC_ADDRESS, USDC_DECIMALS, MarketState, OO_V3_ADDRESS } from "@/lib/chain";
import { MarketInfo, useOutcomeNames } from "@/lib/useMarkets";

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

const COLORS = ["#16c784", "#ea3943", "#f0a020", "#2775CA"];

export function ResolveControl({ market }: { market: MarketInfo }) {
  const { address, isConnected } = useAccount();
  const names = useOutcomeNames(market);
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);

  const now = Math.floor(Date.now() / 1000);
  const closed = now >= Number(market.closeTime);

  // read the assertionId from the market (needed to dispute)
  const { data: assertionId } = useReadContract({
    address: market.address,
    abi: MARKET_ABI,
    functionName: "assertionId",
    query: { enabled: market.state === MarketState.Asserted },
  });

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

  async function dispute() {
    if (!isConnected || !address) {
      (window as any).Telegram?.WebApp?.showAlert?.("Connect wallet first");
      return;
    }
    if (!assertionId) {
      (window as any).Telegram?.WebApp?.showAlert?.("Assertion not found yet, try again in a moment.");
      return;
    }
    setBusy(true);
    try {
      // approve 2 USDC bond to the oracle
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [OO_V3_ADDRESS, parseUnits("5", USDC_DECIMALS)],
      });
      await new Promise((r) => setTimeout(r, 2500));

      // dispute the assertion on the oracle
      await writeContractAsync({
        address: OO_V3_ADDRESS,
        abi: OO_ABI,
        functionName: "disputeAssertion",
        args: [assertionId as `0x${string}`, address],
      });
      haptic("success");
      (window as any).Telegram?.WebApp?.showAlert?.(
        "Disputed! The outcome now goes to UMA's DVM for arbitration."
      );
    } catch (e: any) {
      haptic("error");
      (window as any).Telegram?.WebApp?.showAlert?.("Error: " + (e?.shortMessage || e?.message));
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
          If you believe the proposed outcome is wrong, you can dispute it.
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={settle}
            disabled={busy}
            className="rounded-xl bg-usdc py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "..." : "Finalize result"}
          </button>
          <button
            onClick={dispute}
            disabled={busy}
            className="rounded-xl py-2 text-sm font-semibold disabled:opacity-40"
            style={{ background: "#ea394322", color: "#ea3943" }}
          >
            {busy ? "..." : "Dispute (2 USDC)"}
          </button>
        </div>
      </div>
    );
  }

  if (market.state === MarketState.Open && closed) {
    return (
      <div className="glass mt-2 p-3">
        <div className="text-xs text-white/50">
          Market closed. Propose the winning outcome (requires ~2 USDC bond, returned if correct):
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
