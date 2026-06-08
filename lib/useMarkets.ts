"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { FACTORY_ABI, MARKET_ABI } from "./abis";
import { FACTORY_ADDRESS } from "./chain";

export type MarketInfo = {
  address: `0x${string}`;
  question: string;
  state: number; // 0 = Open, 1 = Resolved
  closeTime: bigint;
  prices: bigint[]; // مقیاس WAD (1e18)
};

/** لیست آدرس همهٔ بازارها از Factory */
export function useMarketAddresses() {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "allMarkets",
  });
}

/** اطلاعات کامل چند بازار با یک batch read */
export function useMarkets(addresses?: readonly `0x${string}`[]) {
  const contracts = (addresses ?? []).flatMap((addr) => [
    { address: addr, abi: MARKET_ABI, functionName: "question" } as const,
    { address: addr, abi: MARKET_ABI, functionName: "state" } as const,
    { address: addr, abi: MARKET_ABI, functionName: "closeTime" } as const,
    { address: addr, abi: MARKET_ABI, functionName: "allPrices" } as const,
  ]);

  const { data, isLoading, refetch } = useReadContracts({
    contracts,
    query: { enabled: (addresses?.length ?? 0) > 0, refetchInterval: 5000 },
  });

  const markets: MarketInfo[] = [];
  if (data && addresses) {
    for (let i = 0; i < addresses.length; i++) {
      const base = i * 4;
      markets.push({
        address: addresses[i],
        question: (data[base]?.result as string) ?? "",
        state: Number(data[base + 1]?.result ?? 0),
        closeTime: (data[base + 2]?.result as bigint) ?? 0n,
        prices: (data[base + 3]?.result as bigint[]) ?? [],
      });
    }
  }
  return { markets, isLoading, refetch };
}

/** تبدیل قیمت WAD به درصد */
export function priceToPercent(wad: bigint): number {
  return Number((wad * 10000n) / 10n ** 18n) / 100;
}
