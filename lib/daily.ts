// DailyPredictions — daily crypto price contest settled by Pyth.
// Fill DAILY_ADDRESS after deploying the contract.

export const DAILY_ADDRESS = (process.env.NEXT_PUBLIC_DAILY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

// Pyth price feed IDs (same on every chain)
export const FEEDS = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
} as const;

export const DAILY_ABI = [
  {
    type: "function",
    name: "currentRound",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getRound",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [
      { name: "startTime", type: "uint64" },
      { name: "closeTime", type: "uint64" },
      { name: "prizePool", type: "uint256" },
      { name: "settled", type: "bool" },
      { name: "winnerCount", type: "uint64" },
      { name: "perWinner", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getQuestion",
    stateMutability: "view",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "i", type: "uint256" },
    ],
    outputs: [
      { name: "feedId", type: "bytes32" },
      { name: "symbol", type: "string" },
      { name: "target", type: "int64" },
      { name: "aboveVotes", type: "uint64" },
      { name: "belowVotes", type: "uint64" },
      { name: "result", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "getVotes",
    stateMutability: "view",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "uint8[3]" }],
  },
  {
    type: "function",
    name: "isWinner",
    stateMutability: "view",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "participantCount",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "vote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "qIndex", type: "uint8" },
      { name: "side", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "voteAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "sides", type: "uint8[3]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "openRound",
    stateMutability: "nonpayable",
    inputs: [
      { name: "feedIds", type: "bytes32[3]" },
      { name: "symbols", type: "string[3]" },
      { name: "targets", type: "int64[3]" },
      { name: "closeTime", type: "uint64" },
      { name: "prizeAmount", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "payable",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "priceUpdate", type: "bytes[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fundPrize",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
