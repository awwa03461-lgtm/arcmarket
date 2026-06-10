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
import { MarketInfo, priceToPercent } from "@/lib/useMarkets";

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
  const [outcome, setOutcome] = useState(0); // 0 = YES, 1 = NO
  const [shares, setShares] = useState("10");
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [busy, setBusy] = useState(false);

  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash: txHash });

  // تخمین قیمت لحظه‌ای نتیجهٔ انتخابی
  const price = market.prices[outcome]
    ? priceToPercent(market.prices[outcome])
    : 50;
  // تخمین خام هزینه: shares * price (USDC) — تخمین UI، قیمت دقیق روی زنجیره
  const estCost = (Number(shares || "0") * price) / 100;
  // maxCost با ۵٪ حاشیهٔ لغزش
  const maxCost = estCost * 1.05;

  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, market.address] : undefined,
    query: { enabled: !!address },
  });

  async function handleBuy() {
    if (!isConnected || !address) {
      const tg = (window as any).Telegram?.WebApp;
      tg?.showAlert?.("Connect wallet first");
      return;
    }
    setBusy(true);
    try {
      const sharesWei = parseUnits(shares || "0", 18);
      const maxCostUnits = parseUnits(maxCost.toFixed(USDC_DECIMALS), USDC_DECIMALS);

      // ۱) approve در صورت نیاز
      const needed = maxCostUnits;
      if (!allowance || (allowance as bigint) < needed) {
        const approveTx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [market.address, parseUnits("1000000", USDC_DECIMALS)],
        });
        // صبر کوتاه برای تأیید approve (در پروداکشن با useWaitForTransactionReceipt)
        await new Promise((r) => setTimeout(r, 2500));
      }

      // ۲) buy
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
      const tg = (window as any).Telegram?.WebApp;
      tg?.showAlert?.("Error: " + (e?.shortMessage || e?.message || "failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="glass w-full rounded-b-none p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h3 className="text-base font-medium leading-snug">{market.question}</h3>

        {/* انتخاب YES / NO */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {["YES", "NO"].map((label, i) => (
            <button
              key={label}
              onClick={() => {
                setOutcome(i);
                haptic("light");
              }}
              className={`num rounded-2xl py-3 text-center font-semibold transition ${
                outcome === i
                  ? i === 0
                    ? "bg-yes text-black"
                    : "bg-no text-white"
                  : "bg-white/5 text-white/60"
              }`}
            >
              {label}
              <div className="text-xs font-normal opacity-80">
                {market.prices[i] ? priceToPercent(market.prices[i]).toFixed(1) : "50"}¢
              </div>
            </button>
          ))}
        </div>

        {/* مقدار شِیر */}
        <div className="mt-4">
          <label className="text-xs text-white/50">تعداد شِیر</label>
          <input
            type="number"
            inputMode="decimal"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            className="num mt-1 w-full rounded-xl bg-white/5 px-4 py-3 text-lg outline-none"
            placeholder="10"
          />
          <div className="mt-1 flex gap-2">
            {["10", "50", "100"].map((v) => (
              <button
                key={v}
                onClick={() => setShares(v)}
                className="num rounded-lg bg-white/5 px-3 py-1 text-xs text-white/60"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* خلاصهٔ هزینه */}
        <div className="num mt-4 flex justify-between rounded-xl bg-white/5 p-3 text-sm">
          <span className="text-white/50">هزینهٔ تخمینی</span>
          <span className="font-semibold">~{estCost.toFixed(2)} USDC</span>
        </div>

        <button
          onClick={handleBuy}
          disabled={busy || confirming || market.state === MarketState.Resolved}
          className="mt-4 w-full rounded-2xl bg-usdc py-4 font-semibold text-white disabled:opacity-40"
        >
          {market.state === MarketState.Resolved
            ? "Market resolved"
            : busy || confirming
            ? "Processing..."
            : `خرید ${shares} ${outcome === 0 ? "YES" : "NO"}`}
        </button>

        {txHash && (
          <>
            <a
              href={`https://testnet.arcscan.app/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-center text-xs text-usdc underline"
            >
              مشاهدهٔ تراکنش روی ArcScan ↗
            </a>
            <button
              onClick={() => {
                const tg = (window as any).Telegram?.WebApp;
                const payload = JSON.stringify({
                  question: market.question,
                  outcome: outcome === 0 ? "YES" : "NO",
                  shares,
                });
                // در Mini App راه‌اندازی‌شده با keyboard button، sendData چت را می‌بندد
                // و داده را به بات می‌فرستد تا در گروه به اشتراک بگذارد
                if (tg?.sendData) tg.sendData(payload);
              }}
              className="mt-2 w-full rounded-xl bg-white/5 py-2.5 text-sm text-white/70"
            >
              📣 اشتراک در چت
            </button>
          </>
        )}
      </div>
    </div>
  );
}
