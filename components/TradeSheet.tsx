"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import { MARKET_ABI, ERC20_ABI } from "@/lib/abis";
import { USDC_ADDRESS, USDC_DECIMALS, MarketState } from "@/lib/chain";
import { MarketInfo, priceToPercent, useOutcomeNames } from "@/lib/useMarkets";

const COLORS = ["#2dd4a7", "#f25e7a", "#f5b14c", "#4d8dff"];

function haptic(type: "success" | "error" | "light") {
  const tg = (window as any).Telegram?.WebApp;
  if (!tg?.HapticFeedback) return;
  if (type === "light") tg.HapticFeedback.impactOccurred("light");
  else tg.HapticFeedback.notificationOccurred(type);
}

export function TradeSheet({
  market,
  onClose,
}: {
  market: MarketInfo;
  onClose: () => void;
}) {
  const { address, isConnected } = useAccount();
  const names = useOutcomeNames(market);
  const [outcome, setOutcome] = useState(0);
  const [shares, setShares] = useState("10");
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [busy, setBusy] = useState(false);

  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash: txHash });

  const price = market.prices[outcome] ? priceToPercent(market.prices[outcome]) : 50;
  const estCost = (Number(shares || "0") * price) / 100;

  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, market.address] : undefined,
    query: { enabled: !!address },
  });

  async function handleBuy() {
    if (!isConnected || !address) {
      (window as any).Telegram?.WebApp?.showAlert?.("Connect wallet first");
      return;
    }
    setBusy(true);
    try {
      const sharesWei = parseUnits(shares || "0", 18);
      // Worst-case cost ceiling: each share can never cost more than 1 USDC,
      // so shares * 1 USDC is a safe upper bound that avoids "slippage" reverts
      // on large buys (the contract still charges only the real LS-LMSR cost).
      const sharesNum = Number(shares || "0");
      const maxCostUnits = parseUnits(
        Math.ceil(sharesNum * 1.0).toFixed(USDC_DECIMALS),
        USDC_DECIMALS
      );

      if (!allowance || (allowance as bigint) < maxCostUnits) {
        await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [market.address, parseUnits("1000000", USDC_DECIMALS)],
        });
        await new Promise((r) => setTimeout(r, 2500));
      }

      const buyTx = await writeContractAsync({
        address: market.address,
        abi: MARKET_ABI,
        functionName: "buy",
        args: [BigInt(outcome), sharesWei, maxCostUnits],
      });
      setTxHash(buyTx);
      haptic("success");
    } catch (e: any) {
      haptic("error");
      (window as any).Telegram?.WebApp?.showAlert?.(
        "Error: " + (e?.shortMessage || e?.message || "failed")
      );
    } finally {
      setBusy(false);
    }
  }

  const resolved = market.state === MarketState.Resolved;
  const outcomeName = names[outcome] || "outcome " + (outcome + 1);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="glass max-h-[90vh] w-full overflow-y-auto rounded-b-none p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--border)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>{market.question}</h3>

        <div className="mt-4 space-y-2">
          {market.prices.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setOutcome(i);
                haptic("light");
              }}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition"
              style={
                outcome === i
                  ? { background: COLORS[i % 4] + "22", color: COLORS[i % 4], outline: "2px solid " + COLORS[i % 4] }
                  : { background: "var(--surface-2)", color: "var(--ink-dim)" }
              }
            >
              <span>{names[i] || "Outcome " + (i + 1)}</span>
              <span className="num">{priceToPercent(p).toFixed(1)}c</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-xs" style={{ color: "var(--ink-dim)" }}>Shares</label>
          <input
            type="number"
            inputMode="decimal"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            className="num mt-1 w-full rounded-xl px-4 py-3 text-lg outline-none"
            style={{ background: "var(--surface-2)", color: "var(--ink)" }}
            placeholder="10"
          />
          <div className="mt-1 flex gap-2">
            {["10", "50", "100"].map((v) => (
              <button
                key={v}
                onClick={() => setShares(v)}
                className="num rounded-lg px-3 py-1 text-xs"
                style={{ background: "var(--surface-2)", color: "var(--ink-dim)" }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="num mt-4 flex justify-between rounded-xl p-3 text-sm" style={{ background: "var(--surface-2)" }}>
          <span style={{ color: "var(--ink-dim)" }}>Est. cost</span>
          <span className="font-semibold" style={{ color: "var(--ink)" }}>~{estCost.toFixed(2)} USDC</span>
        </div>

        <button
          onClick={handleBuy}
          disabled={busy || confirming || resolved}
          className="mt-4 w-full rounded-2xl py-4 font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--usdc)" }}
        >
          {resolved
            ? "Market resolved"
            : busy || confirming
            ? "Processing..."
            : "Buy " + shares + " " + outcomeName}
        </button>

        {txHash && (
          <a
            href={"https://testnet.arcscan.app/tx/" + txHash}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block text-center text-xs underline"
            style={{ color: "var(--usdc)" }}
          >
            View on ArcScan
          </a>
        )}
      </div>
    </div>
  );
}
