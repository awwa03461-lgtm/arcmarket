import { defineChain } from "viem";

// تعریف زنجیرهٔ Arc Testnet
// نکته: viem نسخه‌های جدید ممکن است arcTestnet را به‌صورت built-in داشته باشد؛
// اینجا برای اطمینان دستی تعریف می‌کنیم.
export const arcTestnet = defineChain({
  // آدرس استخر swap (SimpleAMM) روی Arc — USDC/EURC
 export const AMM_ADDRESS =
  "0xa8291c56f63287d4e881E4346662cb3195c23325" as `0x${string}`;
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

// USDC با رابط ERC-20 (۶ رقم اعشار) روی Arc
export const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;

// آدرس Factory بعد از دپلوی اینجا قرار می‌گیرد
export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const USDC_DECIMALS = 6;

// وضعیت بازار (مطابق enum قرارداد UMA)
export const MarketState = { Seeding: 0, Open: 1, Asserted: 2, Resolved: 3 } as const;

// توکن‌های قابل ارسال روی Arc تست‌نت (همه ۶ رقم اعشار)
// نکته: cirBTC را اگر آدرسش را از docs.arc.io داری اینجا جایگزین کن.
export type SendToken = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
};

export const SEND_TOKENS: SendToken[] = [
  { symbol: "USDC", address: "0x3600000000000000000000000000000000000000", decimals: 6 },
  { symbol: "EURC", address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6 },
  // cirBTC: آدرس را از docs.arc.io/arc/references/contract-addresses بردار و اینجا بگذار
  // { symbol: "cirBTC", address: "0x...", decimals: 8 },
];
