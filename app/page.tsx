"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MarketCard } from "@/components/MarketCard";
import { TradeSheet } from "@/components/TradeSheet";
import { CreateMarketSheet } from "@/components/CreateMarketSheet";
import { Portfolio } from "@/components/Portfolio";
import { Send } from "@/components/Send";
import { Swap } from "@/components/Swap";
import { ResolveControl } from "@/components/ResolveControl";
import { useMarketAddresses, useMarkets, MarketInfo } from "@/lib/useMarkets";
import { FACTORY_ADDRESS, MarketState } from "@/lib/chain";

type Tab = "markets" | "portfolio" | "send" | "swap";
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

  const now = Math.floor(Date.now() / 1000);
  function isActive(m: MarketInfo) {
    return m.state === MarketState.Open && now < Number(m.closeTime);
  }
  const activeMarkets = markets.filter(isActive);
  const closedMarkets = markets.filter((m) => !isActive(m));
  const shown = filter === "active" ? activeMarkets : closedMarkets;

  const tabs: { id: Tab; label: string }[] = [
    { id: "markets", label: "Markets" },
    { id: "portfolio", label: "Portfolio" },
    { id: "send", label: "Send" },
    { id: "swap", label: "Swap" },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-5">
      {/* هدر */}
      <header className="mb-5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="display whitespace-nowrap text-xl leading-none">
            Prediction Arc
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="live-dot" />
            <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
              Live on Arc Testnet · USDC
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <ConnectButton />
        </div>
      </header>

      {notDeployed && (
        <div className="glass mb-4 p-3 text-xs" style={{ color: "var(--amber)" }}>
          Factory address not set. Deploy the contract and set
          NEXT_PUBLIC_FACTORY_ADDRESS in env.
        </div>
      )}

      {/* تب‌های اصلی */}
      <div className="glass-2 mb-5 flex gap-1 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "flex-1 rounded-xl py-2.5 text-sm font-semibold transition " +
              (tab === t.id ? "text-ink" : "")
            }
            style={
              tab === t.id
                ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "var(--shadow)" }
                : { color: "var(--ink-dim)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "markets" && (
        <section>
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setFilter("active")}
              className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition"
              style={
                filter === "active"
                  ? { background: "rgba(45,212,167,0.15)", color: "var(--yes)" }
                  : { background: "var(--surface-2)", color: "var(--ink-dim)" }
              }
            >
              {filter === "active" && <span className="live-dot" />}
              Active ({activeMarkets.length})
            </button>
            <button
              onClick={() => setFilter("closed")}
              className="rounded-full px-4 py-1.5 text-xs font-semibold transition"
              style={
                filter === "closed"
                  ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "var(--shadow)" }
                  : { background: "var(--surface-2)", color: "var(--ink-dim)" }
              }
            >
              Closed ({closedMarkets.length})
            </button>
          </div>

          <div className="space-y-3">
            {isLoading && (
              <div className="py-10 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
                Loading…
              </div>
            )}
            {!isLoading && shown.length === 0 && !notDeployed && (
              <div className="glass p-8 text-center">
                <div className="text-sm" style={{ color: "var(--ink-dim)" }}>
                  {filter === "active"
                    ? "No active markets. Create the first one!"
                    : "No closed markets yet."}
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
      {tab === "swap" && <Swap />}

      {!notDeployed && tab === "markets" && (
        <button
          onClick={() => setCreating(true)}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-xl transition active:scale-95"
          style={{ background: "var(--usdc)", boxShadow: "0 8px 24px rgba(47,123,255,0.4)" }}
        >
          + Create market
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
