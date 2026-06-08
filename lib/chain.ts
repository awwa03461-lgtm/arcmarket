import { defineChain } from "viem";

// تعریف زنجیرهٔ Arc Testnet
// نکته: viem نسخه‌های جدید ممکن است arcTestnet را به‌صورت built-in داشته باشد؛
// اینجا برای اطمینان دستی تعریف می‌کنیم.
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

// USDC با رابط ERC-20 (۶ رقم اعشار) روی Arc
export const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;

// آدرس Factory بعد از دپلوی اینجا قرار می‌گیرد
export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const USDC_DECIMALS = 6;

// وضعیت بازار (مطابق enum قرارداد)
export const MarketState = { Seeding: 0, Open: 1, Resolved: 2 } as const;
