"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { FACTORY_ABI, MARKET_ABI, ERC20_ABI } from "./abis";
import { FACTORY_ADDRESS } from "./chain";

export type MarketInfo = {
  address: `0x${string}`;
  question: string;
  state: number; // 0 = Seeding, 1 = Open, 2 = Resolved
  closeTime: bigint;
  prices: bigint[]; // مقیاس WAD (1e18)
  outcomeCount: number;
  winningOutcome: number;
};

export function useMarketAddresses() {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "allMarkets",
  });
}

export function useMarkets(addresses?: readonly `0x${string}`[]) {
  const contracts = (addresses ?? []).flatMap((addr) => [
    { address: addr, abi: MARKET_ABI, functionName: "question" } as const,
    { address: addr, abi: MARKET_ABI, functionName: "state" } as const,
    { address: addr, abi: MARKET_ABI, functionName: "closeTime" } as const,
    { address: addr, abi: MARKET_ABI, functionName: "allPrices" } as const,
    { address: addr, abi: MARKET_ABI, functionName: "outcomeCount" } as const,
    { address: addr, abi: MARKET_ABI, functionName: "winningOutcome" } as const,
  ]);

  const { data, isLoading, refetch } = useReadContracts({
    contracts,
    query: { enabled: (addresses?.length ?? 0) > 0, refetchInterval: 5000 },
  });

  const markets: MarketInfo[] = [];
  if (data && addresses) {
    for (let i = 0; i < addresses.length; i++) {
      const base = i * 6;
      markets.push({
        address: addresses[i],
        question: (data[base]?.result as string) ?? "",
        state: Number(data[base + 1]?.result ?? 0),
        closeTime: (data[base + 2]?.result as bigint) ?? 0n,
        prices: (data[base + 3]?.result as bigint[]) ?? [],
        outcomeCount: Number(data[base + 4]?.result ?? 2),
        winningOutcome: Number(data[base + 5]?.result ?? 0),
      });
    }
  }
  return { markets, isLoading, refetch };
}

// خواندن نام گزینه‌های یک بازار (آدرس توکن‌ها → name هر توکن)
export function useOutcomeNames(market?: MarketInfo) {
  const tokenAddrContracts = market
    ? Array.from({ length: market.outcomeCount }, (_, i) => ({
        address: market.address,
        abi: MARKET_ABI,
        functionName: "getOutcomeToken",
        args: [BigInt(i)],
      }))
    : [];

  const { data: tokenAddrs } = useReadContracts({
    contracts: tokenAddrContracts,
    query: { enabled: !!market },
  });

  const nameContracts =
    tokenAddrs?.map((t) => ({
      address: (t.result as `0x${string}`) ?? "0x0000000000000000000000000000000000000000",
      abi: ERC20_ABI,
      functionName: "name",
    })) ?? [];

  const { data: names } = useReadContracts({
    contracts: nameContracts as any,
    query: { enabled: nameContracts.length > 0 },
  });

  return (names?.map((n) => (n.result as string) ?? "?") ?? []) as string[];
}

export function priceToPercent(wad: bigint): number {
  return Number((wad * 10000n) / 10n ** 18n) / 100;
}
