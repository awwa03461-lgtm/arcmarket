"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { MarketCard } from "@/components/MarketCard";
import { TradeSheet } from "@/components/TradeSheet";
import { CreateMarketSheet } from "@/components/CreateMarketSheet";
import { Portfolio } from "@/components/Portfolio";
import { ResolveControl } from "@/components/ResolveControl";
import { useMarketAddresses, useMarkets, MarketInfo } from "@/lib/useMarkets";
import { FACTORY_ADDRESS } from "@/lib/chain";

type Tab = "markets" | "portfolio";

export default function Home() {
  const { data: addresses } = useMarketAddresses();
  const { markets, isLoading } = useMarkets(
    addresses as readonly `0x${string}`[] | undefined
  );
  const [selected, setSelected] = useState<MarketInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [prefillQuestion, setPrefillQuestion] = useState("");
  const [tab, setTab] = useState<Tab>("markets");

  // خواندن پارامترهای deep-link از بات: ?new=<سؤال> یا ?market=<آدرس>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newQ = params.get("new");
    if (newQ) {
      setPrefillQuestion(decodeURIComponent(newQ));
      setCreating(true);
    }
    // ?market=<addr> در useMarkets بعد از بارگذاری به‌صورت خودکار قابل انتخاب است
  }, []);

  // اگر deep-link به یک بازار خاص بود، بعد از بارگذاری بازارها آن را انتخاب کن
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

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-4">
      {/* هدر */}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🎯 Prediction Arc</h1>
          <p className="text-xs text-white/40">روی Arc Testnet · USDC</p>
        </div>
        <ConnectButton />
      </header>

      {notDeployed && (
        <div className="glass mb-4 border-yellow-500/30 p-3 text-xs text-yellow-300">
          آدرس Factory تنظیم نشده. ابتدا قرارداد را دپلوی و
          NEXT_PUBLIC_FACTORY_ADDRESS را در env قرار دهید.
        </div>
      )}

      {/* تب‌ها */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("markets")}
          className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
            tab === "markets" ? "bg-white/10" : "text-white/40"
          }`}
        >
          بازارها
        </button>
        <button
          onClick={() => setTab("portfolio")}
          className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
            tab === "portfolio" ? "bg-white/10" : "text-white/40"
          }`}
        >
          دارایی‌های من
        </button>
      </div>

      {tab === "markets" && (
        <section className="space-y-3">
          {isLoading && (
            <div className="text-center text-sm text-white/40">در حال بارگذاری…</div>
          )}
          {!isLoading && markets.length === 0 && !notDeployed && (
            <div className="glass p-6 text-center text-sm text-white/50">
              هنوز بازاری وجود ندارد. اولین بازار را بسازید!
            </div>
          )}
          {markets.map((m) => (
            <div key={m.address}>
              <MarketCard market={m} onSelect={setSelected} />
              <ResolveControl market={m} />
            </div>
          ))}
        </section>
      )}

      {tab === "portfolio" && <Portfolio markets={markets} />}

      {/* دکمهٔ شناور ساخت بازار */}
      {!notDeployed && (
        <button
          onClick={() => setCreating(true)}
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-usdc px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-usdc/30"
        >
          ➕ ساخت بازار
        </button>
      )}

      {/* پنل‌ها */}
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
