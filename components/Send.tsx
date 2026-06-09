"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, isAddress } from "viem";
import { ERC20_ABI } from "@/lib/abis";
import { SEND_TOKENS, SendToken } from "@/lib/chain";

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

export function Send() {
  const { address, isConnected } = useAccount();
  const [token, setToken] = useState<SendToken>(SEND_TOKENS[0]);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [busy, setBusy] = useState(false);

  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const { data: balance } = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  const balanceNum = balance
    ? Number(formatUnits(balance as bigint, token.decimals))
    : 0;

  const validTo = isAddress(to);
  const amountNum = Number(amount || "0");
  const canSend =
    isConnected && validTo && amountNum > 0 && amountNum <= balanceNum;

  async function handleSend() {
    if (!canSend) return;
    setBusy(true);
    try {
      const value = parseUnits(amount, token.decimals);
      const tx = await writeContractAsync({
        address: token.address,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [to as `0x${string}`, value],
      });
      setTxHash(tx);
      haptic("success");
    } catch (e: any) {
      haptic("error");
      (window as any).Telegram?.WebApp?.showAlert?.(
        "Error: " + (e?.shortMessage || e?.message || "failed")
      );
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="glass p-6 text-center text-sm text-white/50">
        Connect your wallet to send tokens
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <h3 className="text-base font-semibold">Send tokens</h3>

      {/* انتخاب توکن */}
      <div className="mt-4">
        <label className="text-xs text-white/50">Token</label>
        <div className="mt-1 flex gap-2">
          {SEND_TOKENS.map((t) => (
            <button
              key={t.symbol}
              onClick={() => setToken(t)}
              className={
                "num flex-1 rounded-xl py-2.5 text-sm font-semibold transition " +
                (token.symbol === t.symbol
                  ? "bg-usdc text-white"
                  : "bg-white/5 text-white/60")
              }
            >
              {t.symbol}
            </button>
          ))}
        </div>
        <div className="num mt-2 text-xs text-white/40">
          Balance: {balanceNum.toFixed(2)} {token.symbol}
        </div>
      </div>

      {/* آدرس مقصد */}
      <div className="mt-4">
        <label className="text-xs text-white/50">Recipient address</label>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
          placeholder="0x..."
          className="num mt-1 w-full rounded-xl bg-white/5 px-4 py-3 text-sm outline-none"
        />
        {to.length > 0 && !validTo && (
          <div className="mt-1 text-xs text-no">Invalid address</div>
        )}
      </div>

      {/* مقدار */}
      <div className="mt-4">
        <label className="text-xs text-white/50">Amount</label>
        <div className="relative mt-1">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="num w-full rounded-xl bg-white/5 px-4 py-3 text-lg outline-none"
          />
          <button
            onClick={() => setAmount(String(balanceNum))}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-white/10 px-3 py-1 text-xs text-white/70"
          >
            MAX
          </button>
        </div>
        {amountNum > balanceNum && (
          <div className="mt-1 text-xs text-no">Amount exceeds balance</div>
        )}
      </div>

      <button
        onClick={handleSend}
        disabled={!canSend || busy || confirming}
        className="mt-5 w-full rounded-2xl bg-usdc py-4 font-semibold text-white disabled:opacity-40"
      >
        {busy || confirming
          ? "Sending..."
          : "Send " + (amount || "0") + " " + token.symbol}
      </button>

      {isSuccess && txHash && (
        <a
          href={"https://testnet.arcscan.app/tx/" + txHash}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-center text-xs text-usdc underline"
        >
          Sent! View on ArcScan
        </a>
      )}
    </div>
  );
}
