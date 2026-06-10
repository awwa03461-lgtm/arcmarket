// ABIهای ضروری برای تعامل فرانت‌اند با قراردادها

export const FACTORY_ABI = [
  {
    type: "function",
    name: "createMarket",
    stateMutability: "nonpayable",
    inputs: [
      { name: "question", type: "string" },
      { name: "outcomeNames", type: "string[]" },
      { name: "closeTime", type: "uint64" },
    ],
    outputs: [{ name: "market", type: "address" }],
  },
  {
    type: "function",
    name: "allMarkets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "marketCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "question", type: "string", indexed: false },
      { name: "closeTime", type: "uint64", indexed: false },
    ],
  },
] as const;
