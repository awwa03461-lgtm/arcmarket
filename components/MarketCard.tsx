"use client";

import { MarketInfo, priceToPercent, useOutcomeNames } from "@/lib/useMarkets";
import { MarketState } from "@/lib/chain";

const COLORS = ["#2dd4a7", "#f25e7a", "#f5b14c", "#4d8dff"];

function timeLeft(closeTime: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(closeTime) - now;
  if (diff <= 0) return "Closed";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  if (d > 0) return `${d}d left`;
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h left`;
  return `${m}m left`;
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
  const asserted = market.state === MarketState.Asserted;

  let leadIdx = 0;
  market.prices.forEach((p, i) => {
    if (p > market.prices[leadIdx]) leadIdx = i;
  });

  return (
    <button
      onClick={() => onSelect(market)}
      className="glass w-full p-4 text-left transition active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[15px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>
          {market.question}
        </span>
        {resolved ? (
          <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ background: "rgba(45,212,167,0.15)", color: "var(--yes)" }}>
            Resolved
          </span>
        ) : asserted ? (
          <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ background: "rgba(245,177,76,0.15)", color: "var(--amber)" }}>
            In review
          </span>
        ) : (
          <span className="num shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
            style={{ background: "var(--surface-2)", color: "var(--ink-dim)" }}>
            {timeLeft(market.closeTime)}
          </span>
        )}
      </div>

      {/* گزینهٔ پیشتاز */}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="display text-3xl" style={{ color: COLORS[leadIdx % 4] }}>
          {priceToPercent(market.prices[leadIdx]).toFixed(0)}%
        </span>
        <span className="text-sm" style={{ color: "var(--ink-dim)" }}>
          {names[leadIdx] ?? `Outcome ${leadIdx + 1}`}
          {resolved && market.winningOutcome === leadIdx && " ✓"}
        </span>
      </div>

      {/* نوار احتمال ترکیبی */}
      <div className="prob-track mt-3">
        {market.prices.map((p, i) => (
          <div
            key={i}
            className="prob-fill"
            style={{
              width: `${priceToPercent(p)}%`,
              background: COLORS[i % 4],
              opacity: resolved && market.winningOutcome !== i ? 0.25 : 1,
            }}
          />
        ))}
      </div>

      {/* برچسب‌ها */}
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {market.prices.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i % 4] }} />
            <span style={{ color: "var(--ink-dim)" }}>{names[i] ?? `Outcome ${i + 1}`}</span>
            <span className="num font-semibold" style={{ color: "var(--ink)" }}>
              {priceToPercent(p).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}
