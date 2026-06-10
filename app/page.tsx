"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { MarketCard } from "@/components/MarketCard";
import { TradeSheet } from "@/components/TradeSheet";
import { CreateMarketSheet } from "@/components/CreateMarketSheet";
import { Portfolio } from "@/components/Portfolio";
import { Send } from "@/components/Send";
import { ResolveControl } from "@/components/ResolveControl";
import { useMarketAddresses, useMarkets, MarketInfo } from "@/lib/useMarkets";
import { FACTORY_ADDRESS, MarketState } from "@/lib/chain";

type Tab = "markets" | "portfolio" | "send";
type MarketFilter = "active" | "closed";

export default function Home() {
  const { data: addresses } = useMarketAddresses();
  const { markets, isLoading } = useMarkets(
    addresses as readonly `0x${string}`[] | undefined
  );
  const [selected, setSelected] = useState<MarketInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [prefillQuestion, setPrefillQuestion] = useState("");
  const [tab, setTab] = useState<Tab>("markets");
  const [filter, setFilter] = useState<MarketFilter>("active");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newQ = params.get("new");
    if (newQ) {
      setPrefillQuestion(decodeURIComponent(newQ));
      setCreating(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("market")?.toLowerCase();
    if (target && markets.length > 0 && !selected) {
      const m = markets.find((x) => x.address.toLowerCase() === target);
      if (m) setSelected(m);
    }
  }, [markets, selected]);

  const notDeployed =
    FACTORY_ADDRESS === "0x0000000000000000000000000000000000000000";

  // یک بازار «فعال» است اگر هنوز Open باشد و زمانش نگذشته باشد
  const now = Math.floor(Date.now() / 1000);
  function isActive(m: MarketInfo) {
    return m.state === MarketState.Open && now < Number(m.closeTime);
  }
  const activeMarkets = markets.filter(isActive);
  const closedMarkets = markets.filter((m) => !isActive(m));
  const shown = filter === "active" ? activeMarkets : closedMarkets;

  const tabs: { id: Tab; label: string }[] = [
    { id: "markets", label: "بازارها" },
    { id: "portfolio", label: "دارایی‌ها" },
    { id: "send", label: "ارسال" },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-5">
      {/* هدر */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="display text-2xl leading-none">Prediction Arc</h1>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="live-dot" />
            <p className="text-xs text-ink-dim">Live on Arc Testnet · USDC</p>
          </div>
        </div>
        <ConnectButton />
      </header>

      {notDeployed && (
        <div className="glass mb-4 p-3 text-xs text-amber">
          Factory address not set. Deploy the contract and set
          NEXT_PUBLIC_FACTORY_ADDRESS in env.
        </div>
      )}

      {/* تب‌های اصلی */}
      <div className="mb-5 flex gap-1 rounded-2xl bg-white/5 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "flex-1 rounded-xl py-2.5 text-sm font-semibold transition " +
              (tab === t.id
                ? "bg-white/10 text-ink shadow-sm"
                : "text-ink-dim")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "markets" && (
        <section>
          {/* زیرفیلتر فعال / تمام‌شده */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setFilter("active")}
              className={
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition " +
                (filter === "active"
                  ? "bg-yes/15 text-yes"
                  : "bg-white/5 text-ink-dim")
              }
            >
              {filter === "active" && <span className="live-dot" />}
              فعال ({activeMarkets.length})
            </button>
            <button
              onClick={() => setFilter("closed")}
              className={
                "rounded-full px-4 py-1.5 text-xs font-semibold transition " +
                (filter === "closed"
                  ? "bg-white/15 text-ink"
                  : "bg-white/5 text-ink-dim")
              }
            >
              تمام‌شده ({closedMarkets.length})
            </button>
          </div>

          <div className="space-y-3">
            {isLoading && (
              <div className="py-10 text-center text-sm text-ink-dim">
                در حال بارگذاری…
              </div>
            )}
            {!isLoading && shown.length === 0 && !notDeployed && (
              <div className="glass p-8 text-center">
                <div className="text-sm text-ink-dim">
                  {filter === "active"
                    ? "بازار فعالی نیست. اولین را بسازید!"
                    : "هنوز بازاری تمام نشده."}
                </div>
              </div>
            )}
            {shown.map((m, i) => (
              <div key={m.address} className="rise" style={{ animationDelay: i * 60 + "ms" }}>
                <MarketCard market={m} onSelect={setSelected} />
                <ResolveControl market={m} />
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "portfolio" && <Portfolio markets={markets} />}

      {tab === "send" && <Send />}

      {/* دکمهٔ شناور ساخت بازار — فقط در تب بازارها */}
      {!notDeployed && tab === "markets" && (
        <button
          onClick={() => setCreating(true)}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-usdc px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-usdc/40 transition active:scale-95"
        >
          + ساخت بازار
        </button>
      )}

      {selected && (
        <TradeSheet market={selected} onClose={() => setSelected(null)} />
      )}
      {creating && (
        <CreateMarketSheet
          prefill={prefillQuestion}
          onClose={() => {
            setCreating(false);
            setPrefillQuestion("");
          }}
        />
      )}
    </main>
  );
}
