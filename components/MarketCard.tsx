"use client";

import { MarketInfo, priceToPercent, useOutcomeNames } from "@/lib/useMarkets";
import { MarketState } from "@/lib/chain";

const COLORS = ["#16c784", "#ea3943", "#f0a020", "#2775CA"];

function timeLeft(closeTime: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(closeTime) - now;
  if (diff <= 0) return "بسته شده";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  if (d > 0) return `${d} روز ${h} ساعت`;
  const m = Math.floor((diff % 3600) / 60);
  return `${h} ساعت ${m} دقیقه`;
}

export function MarketCard({
  market,
  onSelect,
}: {
  market: MarketInfo;
  onSelect: (m: MarketInfo) => void;
}) {
  const names = useOutcomeNames(market);
  const resolved = market.state === MarketState.Resolved;

  return (
    <button
      onClick={() => onSelect(market)}
      className="glass w-full p-4 text-right transition active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[15px] font-medium leading-snug">
          {market.question}
        </span>
        {resolved && (
          <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
            حل‌شده
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {market.prices.map((p, i) => {
          const pct = priceToPercent(p);
          const isWinner = resolved && market.winningOutcome === i;
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-xs">
                <span className={isWinner ? "font-bold text-yes" : ""}>
                  {names[i] ?? `گزینه ${i + 1}`} {isWinner && "✓"}
                </span>
                <span className="num font-semibold" style={{ color: COLORS[i % 4] }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="price-bar mt-1 bg-white/5">
                <div
                  className="transition-all"
                  style={{ width: `${pct}%`, background: COLORS[i % 4] }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {!resolved && (
        <div className="mt-2 text-xs text-white/40">
          ⏱ {timeLeft(market.closeTime)} باقی مانده
        </div>
      )}
    </button>
  );
}
