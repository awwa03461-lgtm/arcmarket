// Circle Gateway helpers: build + sign a burn intent with the USER'S wallet
// (viem walletClient via wagmi) — no private key needed. Signs EIP-712 typed
// data, submits to the Gateway API, returns the attestation the seller needs.
//
// Based on Circle's official Gateway how-to + Dynamic's wagmi recipe.

import { pad, maxUint256, type WalletClient } from "viem";

export const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
export const GATEWAY_MINTER = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";
export const USDC_ARC = "0x3600000000000000000000000000000000000000";
export const ARC_DOMAIN = 26; // Circle's domain id for Arc
const GATEWAY_API = "https://gateway-api-testnet.circle.com/v1";

function toBytes32(addr: string): `0x${string}` {
  return pad(addr as `0x${string}`, { size: 32 });
}

// EIP-712 types for a Gateway burn intent (transferSpec).
export const BURN_INTENT_TYPES = {
  BurnIntent: [
    { name: "maxBlockHeight", type: "uint256" },
    { name: "maxFee", type: "uint256" },
    { name: "spec", type: "TransferSpec" },
  ],
  TransferSpec: [
    { name: "version", type: "uint32" },
    { name: "sourceDomain", type: "uint32" },
    { name: "destinationDomain", type: "uint32" },
    { name: "sourceContract", type: "bytes32" },
    { name: "destinationContract", type: "bytes32" },
    { name: "sourceToken", type: "bytes32" },
    { name: "destinationToken", type: "bytes32" },
    { name: "sourceDepositor", type: "bytes32" },
    { name: "destinationRecipient", type: "bytes32" },
    { name: "sourceSigner", type: "bytes32" },
    { name: "destinationCaller", type: "bytes32" },
    { name: "value", type: "uint256" },
    { name: "salt", type: "bytes32" },
    { name: "hookData", type: "bytes" },
  ],
} as const;

const DOMAIN = { name: "GatewayWallet", version: "1" } as const;

function randomSalt(): `0x${string}` {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

// Build a burn intent that pays `value` (atomic USDC, 6 dp) from buyer to seller.
export function buildBurnIntent(buyer: string, seller: string, value: bigint) {
  return {
    maxBlockHeight: maxUint256,
    maxFee: 2_010000n, // headroom for Gateway fee
    spec: {
      version: 1,
      sourceDomain: ARC_DOMAIN,
      destinationDomain: ARC_DOMAIN,
      sourceContract: toBytes32(GATEWAY_WALLET),
      destinationContract: toBytes32(GATEWAY_MINTER),
      sourceToken: toBytes32(USDC_ARC),
      destinationToken: toBytes32(USDC_ARC),
      sourceDepositor: toBytes32(buyer),
      destinationRecipient: toBytes32(seller),
      sourceSigner: toBytes32(buyer),
      destinationCaller: toBytes32("0x0000000000000000000000000000000000000000"),
      value,
      salt: randomSalt(),
      hookData: "0x" as `0x${string}`,
    },
  };
}

// Sign the burn intent with the user's wallet (EIP-712) and submit to Gateway.
// Returns { attestation, signature } the seller uses to settle.
export async function signAndSubmitBurnIntent(
  walletClient: WalletClient,
  account: `0x${string}`,
  intent: ReturnType<typeof buildBurnIntent>
) {
  const signature = await walletClient.signTypedData({
    account,
    domain: DOMAIN,
    types: BURN_INTENT_TYPES,
    primaryType: "BurnIntent",
    message: intent as any,
  });

  const res = await fetch(GATEWAY_API + "/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      [{ burnIntent: intent, signature }],
      (_k, v) => (typeof v === "bigint" ? v.toString() : v)
    ),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Gateway transfer failed: " + t.slice(0, 200));
  }
  const data = await res.json();
  return { attestation: data.attestation, gatewaySig: data.signature };
}
