import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

// Factory address (set via env in production)
export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

// USDC on Arc (ERC-20 interface, 6 decimals)
export const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as `0x${string}`;
export const USDC_DECIMALS = 6;
// SimpleAMM pool on Arc — USDC/EURC swap
export const AMM_ADDRESS =
  "0xa8291c56f63287d4e881E4346662cb3195c23325" as `0x${string};

// Market state enum (matches the UMA-integrated contract)
export const MarketState = { Seeding: 0, Open: 1, Asserted: 2, Resolved: 3 } as const;

// Tokens available for Send (all 6 decimals on Arc)
export type SendToken = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
};

export const SEND_TOKENS: SendToken[] = [
  { symbol: "USDC", address: "0x3600000000000000000000000000000000000000", decimals: 6 },
  { symbol: "EURC", address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6 },
  // cirBTC: add the address from docs.arc.io if you want to support it
  // { symbol: "cirBTC", address: "0x...", decimals: 8 },
];

// UMA Optimistic Oracle V3 (deployed sandbox on Arc)
export const OO_V3_ADDRESS =
  "0xB5Ef5d9EbCDef8245062DbBdEd18c6CF557ccE54" as `0x${string}`;
