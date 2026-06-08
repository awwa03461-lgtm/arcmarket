"use client";

import { useReadContracts } from "wagmi";
import { MARKET_ABI, ERC20_ABI } from "./abis";
import { MarketInfo } from "./useMarkets";
import { MarketState } from "./chain";

export type Position = {
  market: MarketInfo;
  yesShares: bigint;
  noShares: bigint;
  resolved: boolean;
  winningOutcome: number;
};

/**
 * برای هر بازار، آدرس توکن YES/NO و سپس موجودی کاربر را می‌خواند.
 * یک batch read برای کارایی.
 */
export function usePositions(
  markets: MarketInfo[],
  user?: `0x${string}`
) {
  // مرحلهٔ ۱: آدرس توکن‌های YES/NO هر بازار + نتیجهٔ برنده
  const tokenContracts = markets.flatMap((m) => [
    { address: m.address, abi: MARKET_ABI, functionName: "getOutcomeToken", args: [0n] } as const,
    { address: m.address, abi: MARKET_ABI, functionName: "getOutcomeToken", args: [1n] } as const,
    { address: m.address, abi: MARKET_ABI, functionName: "winningOutcome" } as const,
  ]);

  const { data: tokenData } = useReadContracts({
    contracts: tokenContracts,
    query: { enabled: markets.length > 0 && !!user },
  });

  // مرحلهٔ ۲: موجودی کاربر در هر توکن
  const balanceContracts: any[] = [];
  if (tokenData && user) {
    for (let i = 0; i < markets.length; i++) {
      const yesToken = tokenData[i * 3]?.result as `0x${string}`;
      const noToken = tokenData[i * 3 + 1]?.result as `0x${string}`;
      if (yesToken)
        balanceContracts.push({
          address: yesToken,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [user],
        });
      if (noToken)
        balanceContracts.push({
          address: noToken,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [user],
        });
    }
  }

  const { data: balData } = useReadContracts({
    contracts: balanceContracts,
    query: { enabled: balanceContracts.length > 0, refetchInterval: 5000 },
  });

  const positions: Position[] = [];
  if (tokenData && balData && user) {
    for (let i = 0; i < markets.length; i++) {
      const yesShares = (balData[i * 2]?.result as bigint) ?? 0n;
      const noShares = (balData[i * 2 + 1]?.result as bigint) ?? 0n;
      if (yesShares === 0n && noShares === 0n) continue;
      positions.push({
        market: markets[i],
        yesShares,
        noShares,
        resolved: markets[i].state === MarketState.Resolved,
        winningOutcome: Number(tokenData[i * 3 + 2]?.result ?? 0),
      });
    }
  }
  return positions;
}

export function formatShares(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(2);
}
