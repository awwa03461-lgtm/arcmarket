"use client";

import { useWriteContract } from "wagmi";
import { MARKET_ABI } from "@/lib/abis";
import { MarketInfo } from "@/lib/useMarkets";
import { MarketState } from "@/lib/chain";

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

/**
 * کنترل تسویه — فقط برای سازنده/admin بازار.
 * فعلاً تسویهٔ دستی؛ در آینده با UMA جایگزین می‌شود (پوشهٔ contracts/ResolutionModule).
 */
export function ResolveControl({ market }: { market: MarketInfo }) {
  const { writeContractAsync } = useWriteContract();

  async function resolve(outcome: number) {
    const tg = (window as any).Telegram?.WebApp;
    try {
      await writeContractAsync({
        address: market.address,
        abi: MARKET_ABI,
        functionName: "resolve",
        args: [BigInt(outcome)],
      });
      haptic("success");
      tg?.showAlert?.(`✅ بازار با نتیجهٔ ${outcome === 0 ? "YES" : "NO"} حل شد`);
    } catch (e: any) {
      haptic("error");
      tg?.showAlert?.("خطا: " + (e?.shortMessage || e?.message));
    }
  }

  if (market.state !== MarketState.Open) return null;

  return (
    <div className="glass mt-2 p-3">
      <div className="text-xs text-white/50">
        🛠 تسویهٔ بازار (فقط سازنده) — نتیجهٔ نهایی را ثبت کنید:
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => resolve(0)}
          className="rounded-xl bg-yes/20 py-2 text-sm font-semibold text-yes"
        >
          YES برنده شد
        </button>
        <button
          onClick={() => resolve(1)}
          className="rounded-xl bg-no/20 py-2 text-sm font-semibold text-no"
        >
          NO برنده شد
        </button>
      </div>
    </div>
  );
}
