"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWalletClient,
  usePublicClient,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import {
  GATEWAY_WALLET,
  USDC_ARC,
  buildBurnIntent,
  signAndSubmitBurnIntent,
} from "@/lib/gateway";

const ERC20 = [
  { type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }],
    outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "o", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// Minimal Gateway Wallet ABI: deposit(token, amount)
const GATEWAY_ABI = [
  { type: "function", name: "deposit", stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [] },
  { type: "function", name: "availableBalance", stateMutability: "view",
    inputs: [{ name: "token", type: "address" }, { name: "depositor", type: "address" }],
    outputs: [{ type: "uint256" }] },
] as const;

const SELLER = process.env.NEXT_PUBLIC_SELLER_ADDRESS as `0x${string}`;

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

export function AnalyzeTab({ marketQuestion }: { marketQuestion?: string }) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [depositAmt, setDepositAmt] = useState("1");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [question, setQuestion] = useState(marketQuestion || "");
  const [analysis, setAnalysis] = useState("");

  // wallet USDC balance
  const { data: walletBal } = useReadContract({
    address: USDC_ARC, abi: ERC20, functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });
  // gateway deposited balance
  const { data: gwBal, refetch: refetchGw } = useReadContract({
    address: GATEWAY_WALLET as `0x${string}`, abi: GATEWAY_ABI,
    functionName: "availableBalance",
    args: address ? [USDC_ARC, address] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  const walletUsdc = walletBal ? Number(formatUnits(walletBal as bigint, 6)) : 0;
  const gatewayUsdc = gwBal ? Number(formatUnits(gwBal as bigint, 6)) : 0;

  // STEP 1: one-time deposit into Gateway
  async function deposit() {
    if (!address || !publicClient) return;
    setBusy(true);
    try {
      const amt = parseUnits(depositAmt || "0", 6);
      setStatus("Approving USDC...");
      const ap = await writeContractAsync({
        address: USDC_ARC, abi: ERC20, functionName: "approve",
        args: [GATEWAY_WALLET as `0x${string}`, amt],
      });
      await publicClient.waitForTransactionReceipt({ hash: ap });

      setStatus("Depositing into Gateway...");
      const dp = await writeContractAsync({
        address: GATEWAY_WALLET as `0x${string}`, abi: GATEWAY_ABI,
        functionName: "deposit", args: [USDC_ARC, amt],
      });
      await publicClient.waitForTransactionReceipt({ hash: dp });

      setStatus("Deposited! You can now run analyses.");
      haptic("success");
      refetchGw();
    } catch (e: any) {
      haptic("error");
      setStatus("Error: " + (e?.shortMessage || e?.message));
    } finally {
      setBusy(false);
    }
  }

  // STEP 2: pay + analyze
  async function analyze() {
    if (!address || !walletClient) return;
    if (!question.trim()) { setStatus("Enter a market question first."); return; }
    setBusy(true);
    setAnalysis("");
    try {
      // First call — expect 402 with payment details
      setStatus("Requesting analysis...");
      const first = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (first.status === 402) {
        // Build + sign a burn intent for $0.01 and retry
        setStatus("Confirm the $0.01 payment in your wallet...");
        const intent = buildBurnIntent(address, SELLER, 10000n); // 0.01 USDC
        const { attestation, gatewaySig } = await signAndSubmitBurnIntent(
          walletClient, address, intent
        );

        setStatus("Getting your analysis...");
        const paid = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Payment-Attestation": attestation,
            "X-Payment-Signature": gatewaySig,
          },
          body: JSON.stringify({ question }),
        });
        const data = await paid.json();
        setAnalysis(data.analysis || data.error || "No analysis.");
        setStatus("");
        haptic("success");
      } else {
        const data = await first.json();
        setAnalysis(data.analysis || data.error || "No analysis.");
        setStatus("");
      }
    } catch (e: any) {
      haptic("error");
      setStatus("Error: " + (e?.shortMessage || e?.message));
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="glass p-6 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
        Connect your wallet to use AI market analysis
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
        AI Market Analysis
      </h3>
      <p className="mt-1 text-xs" style={{ color: "var(--ink-dim)" }}>
        Get a neutral, research-backed briefing on any market for $0.01 USDC,
        paid gaslessly via Circle Gateway nanopayments.
      </p>

      {/* balances */}
      <div className="glass-2 mt-4 flex justify-between p-3 text-xs">
        <span style={{ color: "var(--ink-dim)" }}>
          Wallet: <span className="num" style={{ color: "var(--ink)" }}>{walletUsdc.toFixed(2)} USDC</span>
        </span>
        <span style={{ color: "var(--ink-dim)" }}>
          Gateway: <span className="num" style={{ color: "var(--usdc)" }}>{gatewayUsdc.toFixed(2)} USDC</span>
        </span>
      </div>

      {/* deposit (one-time) */}
      {gatewayUsdc < 0.01 && (
        <div className="glass-2 mt-3 p-3">
          <div className="text-xs" style={{ color: "var(--ink-dim)" }}>
            One-time: deposit USDC into Gateway to enable gasless payments.
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="number" value={depositAmt}
              onChange={(e) => setDepositAmt(e.target.value)}
              className="num w-20 rounded-lg px-2 py-1 text-sm"
              style={{ background: "var(--surface-2)", color: "var(--ink)" }}
            />
            <button
              onClick={deposit} disabled={busy}
              className="flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--usdc)" }}
            >
              {busy ? "..." : "Deposit to Gateway"}
            </button>
          </div>
        </div>
      )}

      {/* question + analyze */}
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. Will Bitcoin close above $120k this month?"
        rows={2}
        className="mt-3 w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: "var(--surface-2)", color: "var(--ink)" }}
      />
      <button
        onClick={analyze}
        disabled={busy || gatewayUsdc < 0.01}
        className="mt-3 w-full rounded-2xl py-4 font-semibold text-white disabled:opacity-40"
        style={{ background: "var(--usdc)" }}
      >
        {busy ? "Working..." : "🔍 Analyze ($0.01)"}
      </button>

      {status && (
        <div className="mt-3 text-center text-xs" style={{ color: "var(--ink-dim)" }}>{status}</div>
      )}

      {analysis && (
        <div className="glass-2 mt-4 p-4 text-sm" style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>
          {analysis}
          <div className="mt-3 text-[10px]" style={{ color: "var(--ink-dim)" }}>
            Informational only. Not betting advice.
          </div>
        </div>
      )}
    </div>
  );
}
