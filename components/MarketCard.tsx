"use client";

import { MarketInfo, priceToPercent } from "@/lib/useMarkets";
import { MarketState } from "@/lib/chain";

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
  const yes = market.prices[0] ? priceToPercent(market.prices[0]) : 50;
  const no = market.prices[1] ? priceToPercent(market.prices[1]) : 50;
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

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="num font-semibold text-yes">YES {yes.toFixed(1)}%</span>
        <span className="num font-semibold text-no">NO {no.toFixed(1)}%</span>
      </div>

      <div className="price-bar mt-2 bg-white/5">
        <div className="bg-yes transition-all" style={{ width: `${yes}%` }} />
        <div className="bg-no transition-all" style={{ width: `${no}%` }} />
      </div>

      {!resolved && (
        <div className="mt-2 text-xs text-white/40">
          ⏱ {timeLeft(market.closeTime)} باقی مانده
        </div>
      )}
    </button>
  );
}
