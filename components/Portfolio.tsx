"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContracts } from "wagmi";
import { MARKET_ABI, ERC20_ABI } from "@/lib/abis";
import { MarketInfo, useOutcomeNames } from "@/lib/useMarkets";
import { MarketState } from "@/lib/chain";

const COLORS = ["#16c784", "#ea3943", "#f0a020", "#2775CA"];

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

function fmt(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n) / 10n ** 16n;
  return `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}

function MarketPositions({ market }: { market: MarketInfo }) {
  const { address } = useAccount();
  const names = useOutcomeNames(market);
  const { writeContractAsync } = useWriteContract();

  // آدرس توکن هر گزینه
  const tokenContracts = Array.from({ length: market.outcomeCount }, (_, i) => ({
    address: market.address,
    abi: MARKET_ABI,
    functionName: "getOutcomeToken",
    args: [BigInt(i)],
  }));
  const { data: tokenAddrs } = useReadContracts({
    contracts: tokenContracts as any,
    query: { enabled: market.outcomeCount > 0 },
  });

  // موجودی کاربر در هر توکن
  const balContracts =
    tokenAddrs && address
      ? tokenAddrs.map((t) => ({
          address: (t.result as `0x${string}`) ?? "0x0000000000000000000000000000000000000000",
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }))
      : [];
  const { data: bals } = useReadContracts({
    contracts: balContracts as any,
    query: { enabled: balContracts.length > 0, refetchInterval: 8000 },
  });

  if (!bals) return null;
  const shares = bals.map((b) => (b.result as bigint | undefined) ?? 0n);
  const hasAny = shares.some((s) => s > 0n);
  if (!hasAny) return null;

  const resolved = market.state === MarketState.Resolved;
  const won = resolved && shares[market.winningOutcome] > 0n;

  async function redeem() {
    try {
      await writeContractAsync({
        address: market.address,
        abi: MARKET_ABI,
        functionName: "redeem",
      });
      haptic("success");
      (window as any).Telegram?.WebApp?.showAlert?.("✅ سود برداشت شد!");
    } catch (e: any) {
      haptic("error");
      (window as any).Telegram?.WebApp?.showAlert?.("خطا: " + (e?.shortMessage || e?.message));
    }
  }

  async function sell(i: number, amount: bigint) {
    try {
      await writeContractAsync({
        address: market.address,
        abi: MARKET_ABI,
        functionName: "sell",
        args: [BigInt(i), amount, 0n],
      });
      haptic("success");
      (window as any).Telegram?.WebApp?.showAlert?.("✅ فروخته شد!");
    } catch (e: any) {
      haptic("error");
      (window as any).Telegram?.WebApp?.showAlert?.("خطا: " + (e?.shortMessage || e?.message));
    }
  }

  return (
    <div className="glass p-4">
      <div className="text-sm font-medium leading-snug">{market.question}</div>
      <div className="mt-3 space-y-2">
        {shares.map((s, i) =>
          s > 0n ? (
            <div key={i} className="flex items-center justify-between">
              <span className="num text-sm" style={{ color: COLORS[i % 4] }}>
                {names[i] ?? `گزینه ${i + 1}`}: {fmt(s)}
              </span>
              {!resolved && (
                <button
                  onClick={() => sell(i, s)}
                  className="rounded-lg bg-white/10 px-3 py-1 text-xs"
                >
                  فروش
                </button>
              )}
            </div>
          ) : null
        )}
      </div>
      {won && (
        <button
          onClick={redeem}
          className="mt-3 w-full rounded-xl bg-yes py-2.5 text-sm font-semibold text-black"
        >
          💰 برداشت سود
        </button>
      )}
      {resolved && !won && (
        <div className="mt-2 text-xs text-no">این بازار را باختید</div>
      )}
    </div>
  );
}

export function Portfolio({ markets }: { markets: MarketInfo[] }) {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  if (!isConnected)
    return (
      <div className="glass p-6 text-center text-sm text-white/50">
        برای دیدن دارایی‌ها کیف پول را وصل کنید
      </div>
    );
  if (markets.length === 0)
    return (
      <div className="glass p-6 text-center text-sm text-white/50">
        هنوز پوزیشنی ندارید.
      </div>
    );

  return (
    <div className="space-y-3">
      {markets.map((m) => (
        <MarketPositions key={m.address} market={m} />
      ))}
    </div>
  );
}
