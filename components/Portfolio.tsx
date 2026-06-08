"use client";

import { useAccount, useWriteContract } from "wagmi";
import { MARKET_ABI } from "@/lib/abis";
import { useMarkets, MarketInfo } from "@/lib/useMarkets";
import { usePositions, formatShares, Position } from "@/lib/usePositions";

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

function PositionCard({ pos }: { pos: Position }) {
  const { writeContractAsync } = useWriteContract();

  async function redeem() {
    try {
      await writeContractAsync({
        address: pos.market.address,
        abi: MARKET_ABI,
        functionName: "redeem",
      });
      haptic("success");
      (window as any).Telegram?.WebApp?.showAlert?.("✅ سود برداشت شد!");
    } catch (e: any) {
      haptic("error");
      (window as any).Telegram?.WebApp?.showAlert?.(
        "خطا: " + (e?.shortMessage || e?.message)
      );
    }
  }

  const wonYes = pos.resolved && pos.winningOutcome === 0 && pos.yesShares > 0n;
  const wonNo = pos.resolved && pos.winningOutcome === 1 && pos.noShares > 0n;
  const canRedeem = wonYes || wonNo;
  const lost =
    pos.resolved &&
    ((pos.winningOutcome === 0 && pos.noShares > 0n && pos.yesShares === 0n) ||
      (pos.winningOutcome === 1 && pos.yesShares > 0n && pos.noShares === 0n));

  return (
    <div className="glass p-4">
      <div className="text-sm font-medium leading-snug">{pos.market.question}</div>
      <div className="num mt-2 flex gap-4 text-sm">
        {pos.yesShares > 0n && (
          <span className="text-yes">YES: {formatShares(pos.yesShares)}</span>
        )}
        {pos.noShares > 0n && (
          <span className="text-no">NO: {formatShares(pos.noShares)}</span>
        )}
      </div>

      {!pos.resolved && (
        <div className="mt-2 text-xs text-white/40">⏳ بازار هنوز باز است</div>
      )}
      {canRedeem && (
        <button
          onClick={redeem}
          className="mt-3 w-full rounded-xl bg-yes py-2.5 text-sm font-semibold text-black"
        >
          💰 برداشت سود
        </button>
      )}
      {lost && (
        <div className="mt-2 text-xs text-no">این پوزیشن بازنده شد</div>
      )}
    </div>
  );
}

export function Portfolio({ markets }: { markets: MarketInfo[] }) {
  const { address, isConnected } = useAccount();
  const positions = usePositions(markets, address);

  if (!isConnected)
    return (
      <div className="glass p-6 text-center text-sm text-white/50">
        برای دیدن دارایی‌ها کیف پول را وصل کنید
      </div>
    );

  if (positions.length === 0)
    return (
      <div className="glass p-6 text-center text-sm text-white/50">
        هنوز پوزیشنی ندارید. روی یک بازار شرط ببندید!
      </div>
    );

  return (
    <div className="space-y-3">
      {positions.map((p) => (
        <PositionCard key={p.market.address} pos={p} />
      ))}
    </div>
  );
}
