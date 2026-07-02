"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ERC20_ABI, AMM_ABI } from "@/lib/abis";
import { AMM_ADDRESS } from "@/lib/chain";

const USDC = "0x3600000000000000000000000000000000000000" as `0x${string}`;
const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as `0x${string}`;

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

export function Swap() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  // direction: true = USDC->EURC, false = EURC->USDC
  const [usdcToEurc, setUsdcToEurc] = useState(true);
  const [amount, setAmount] = useState("");
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [busy, setBusy] = useState(false);

  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const tokenIn = usdcToEurc ? USDC : EURC;
  const symbolIn = usdcToEurc ? "USDC" : "EURC";
  const symbolOut = usdcToEurc ? "EURC" : "USDC";

  const { data: balance } = useReadContract({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });
  const balanceNum = balance ? Number(formatUnits(balance as bigint, 6)) : 0;

  const amountInWei =
    amount && Number(amount) > 0 ? parseUnits(amount, 6) : 0n;
  const { data: amountOut } = useReadContract({
    address: AMM_ADDRESS,
    abi: AMM_ABI,
    functionName: "getAmountOut",
    args: [tokenIn, amountInWei],
    query: { enabled: amountInWei > 0n },
  });
  const outNum = amountOut ? Number(formatUnits(amountOut as bigint, 6)) : 0;

  const amountNum = Number(amount || "0");
  const canSwap =
    isConnected && amountNum > 0 && amountNum <= balanceNum && outNum > 0;

  async function handleSwap() {
    if (!canSwap) return;
    setBusy(true);
    try {
      const approveTx = await writeContractAsync({
        address: tokenIn,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [AMM_ADDRESS, amountInWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      } else {
        await new Promise((r) => setTimeout(r, 6000));
      }

      const minOut = amountOut ? ((amountOut as bigint) * 98n) / 100n : 0n;

      const tx = await writeContractAsync({
        address: AMM_ADDRESS,
        abi: AMM_ABI,
        functionName: "swap",
        args: [tokenIn, amountInWei, minOut],
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
      <div className="glass p-6 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
        Connect your wallet to swap
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>Swap</h3>

      {/* token in */}
      <div className="glass-2 mt-4 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--ink-dim)" }}>From</span>
          <span className="num text-xs" style={{ color: "var(--ink-dim)" }}>
            Balance: {balanceNum.toFixed(2)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="num flex-1 bg-transparent text-2xl outline-none"
            style={{ color: "var(--ink)" }}
          />
          <span className="num rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--surface-2)", color: "var(--ink)" }}>
            {symbolIn}
          </span>
        </div>
        <button
          onClick={() => setAmount(String(balanceNum))}
          className="mt-1 text-xs"
          style={{ color: "var(--usdc)" }}
        >
          MAX
        </button>
      </div>

      {/* flip direction */}
      <div className="my-2 flex justify-center">
        <button
          onClick={() => {
            setUsdcToEurc(!usdcToEurc);
            setAmount("");
          }}
          className="rounded-full p-2 text-lg"
          style={{ background: "var(--surface-2)", color: "var(--ink)" }}
        >
          ↓↑
        </button>
      </div>

      {/* token out */}
      <div className="glass-2 p-4">
        <span className="text-xs" style={{ color: "var(--ink-dim)" }}>To (estimated)</span>
        <div className="mt-1 flex items-center gap-2">
          <span className="num flex-1 text-2xl" style={{ color: "var(--ink)" }}>
            {outNum.toFixed(4)}
          </span>
          <span className="num rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--surface-2)", color: "var(--ink)" }}>
            {symbolOut}
          </span>
        </div>
      </div>

      {amountNum > balanceNum && (
        <div className="mt-2 text-xs" style={{ color: "var(--no)" }}>
          Amount exceeds balance
        </div>
      )}

      <button
        onClick={handleSwap}
        disabled={!canSwap || busy || confirming}
        className="mt-4 w-full rounded-2xl py-4 font-semibold text-white disabled:opacity-40"
        style={{ background: "var(--usdc)" }}
      >
        {busy || confirming
          ? "Swapping..."
          : "Swap " + symbolIn + " -> " + symbolOut}
      </button>

      {isSuccess && txHash && (
        <a
          href={"https://testnet.arcscan.app/tx/" + txHash}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-center text-xs underline"
          style={{ color: "var(--usdc)" }}
        >
          Swapped! View on ArcScan
        </a>
      )}

      <p className="mt-3 text-center text-[10px]" style={{ color: "var(--ink-dim)" }}>
        Testnet AMM · 0.3% fee · rate from pool reserves
      </p>
    </div>
  );
}
