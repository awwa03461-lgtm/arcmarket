"use client";

import { useReadContracts } from "wagmi";
import { MARKET_ABI, ERC20_ABI } from "./abis";
import { MarketInfo } from "./useMarkets";
import { MarketState } from "./chain";

type Address = `0x${string}`;
const ZERO: Address = "0x0000000000000000000000000000000000000000";

export type Position = {
  market: MarketInfo;
  yesShares: bigint;
  noShares: bigint;
  resolved: boolean;
  winningOutcome: number;
};

export function usePositions(markets: MarketInfo[], user?: Address) {
  const hasInput = markets.length > 0 && !!user;

  const tokenContracts = hasInput
    ? markets.flatMap((m) => [
        { address: m.address, abi: MARKET_ABI, functionName: "getOutcomeToken", args: [0n] } as const,
        { address: m.address, abi: MARKET_ABI, functionName: "getOutcomeToken", args: [1n] } as const,
        { address: m.address, abi: MARKET_ABI, functionName: "winningOutcome" } as const,
      ])
    : [];

  const { data: tokenData } = useReadContracts({
    contracts: tokenContracts,
    query: { enabled: tokenContracts.length > 0 },
  });

  const balanceContracts =
    tokenData && user
      ? markets.flatMap((_, i) => {
          const yesToken = (tokenData[i * 3]?.result as Address | undefined) ?? ZERO;
          const noToken = (tokenData[i * 3 + 1]?.result as Address | undefined) ?? ZERO;
          return [
            { address: yesToken, abi: ERC20_ABI, functionName: "balanceOf", args: [user] } as const,
            { address: noToken, abi: ERC20_ABI, functionName: "balanceOf", args: [user] } as const,
          ];
        })
      : [];

  const { data: balData } = useReadContracts({
    contracts: balanceContracts,
    query: { enabled: balanceContracts.length > 0, refetchInterval: 8000 },
  });

  const positions: Position[] = [];
  if (tokenData && balData && user) {
    for (let i = 0; i < markets.length; i++) {
      const yesShares = (balData[i * 2]?.result as bigint | undefined) ?? 0n;
      const noShares = (balData[i * 2 + 1]?.result as bigint | undefined) ?? 0n;
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
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n) / 10n ** 16n;
  return `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}
