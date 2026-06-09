"use client";

import { useState } from "react";
import { useWriteContract, useAccount, useReadContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { FACTORY_ABI, ERC20_ABI } from "@/lib/abis";
import { FACTORY_ADDRESS, USDC_ADDRESS, USDC_DECIMALS } from "@/lib/chain";

function haptic(type: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type);
}

// subsidy = B_MIN(70) * ln(n) USDC
function estSubsidy(n: number): number {
  return Math.ceil(70 * Math.log(n));
}

export function CreateMarketSheet({
  prefill,
  onClose,
}: {
  prefill?: string;
  onClose: () => void;
}) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [question, setQuestion] = useState(prefill || "");
  const [outcomes, setOutcomes] = useState<string[]>(["", ""]);
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);

  const subsidy = estSubsidy(outcomes.length);

  // موجودی USDC کاربر
  const { data: balance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const balanceNum = balance ? Number(formatUnits(balance as bigint, USDC_DECIMALS)) : 0;
  const enoughBalance = balanceNum >= subsidy;

  function setOutcome(i: number, val: string) {
    const next = [...outcomes];
    next[i] = val;
    setOutcomes(next);
  }
  function addOutcome() {
    if (outcomes.length < 4) setOutcomes([...outcomes, ""]);
  }
  function removeOutcome(i: number) {
    if (outcomes.length > 2) setOutcomes(outcomes.filter((_, idx) => idx !== i));
  }

  async function handleCreate() {
    if (!isConnected) {
      (window as any).Telegram?.WebApp?.showAlert?.("Connect wallet first");
      return;
    }
    if (question.trim().length < 8) {
      (window as any).Telegram?.WebApp?.showAlert?.("Question too short");
      return;
    }
    const clean = outcomes.map((o) => o.trim());
    if (clean.some((o) => o.length === 0)) {
      (window as any).Telegram?.WebApp?.showAlert?.("Fill all outcomes");
      return;
    }
    if (!enoughBalance) {
      (window as any).Telegram?.WebApp?.showAlert?.(
        "Not enough USDC. You need " + subsidy + " USDC but have " + balanceNum.toFixed(2) + ". Get more from faucet.circle.com"
      );
      return;
    }
    setBusy(true);
    try {
      const closeTime = BigInt(
        Math.floor(Date.now() / 1000) + Number(days || "7") * 86400
      );
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [FACTORY_ADDRESS, parseUnits(String(subsidy + 20), USDC_DECIMALS)],
      });
      await new Promise((r) => setTimeout(r, 2500));

      await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createMarket",
        args: [question.trim(), clean, closeTime],
      });
      haptic("success");
      (window as any).Telegram?.WebApp?.showAlert?.("Market created!");
      onClose();
    } catch (e: any) {
      haptic("error");
      (window as any).Telegram?.WebApp?.showAlert?.(
        "Error: " + (e?.shortMessage || e?.message || "failed")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="glass max-h-[90vh] w-full overflow-y-auto rounded-b-none p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h3 className="text-base font-semibold">New Market</h3>

        <div className="mt-4">
          <label className="text-xs text-white/50">Question</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="Which team will win?"
            className="mt-1 w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm outline-none"
          />
        </div>

        <div className="mt-4">
          <label className="text-xs text-white/50">Outcomes ({outcomes.length}/4)</label>
          <div className="mt-1 space-y-2">
            {outcomes.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={o}
                  onChange={(e) => setOutcome(i, e.target.value)}
                  placeholder={"Outcome " + (i + 1)}
                  className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-sm outline-none"
                />
                {outcomes.length > 2 && (
                  <button
                    onClick={() => removeOutcome(i)}
                    className="rounded-xl bg-white/5 px-3 text-no"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
          </div>
          {outcomes.length < 4 && (
            <button
              onClick={addOutcome}
              className="mt-2 w-full rounded-xl border border-dashed border-white/20 py-2 text-sm text-white/60"
            >
              + Add outcome
            </button>
          )}
        </div>

        <div className="mt-4">
          <label className="text-xs text-white/50">Duration (days)</label>
          <div className="mt-1 flex gap-2">
            {["1", "7", "30"].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={
                  "num flex-1 rounded-xl py-2 text-sm transition " +
                  (days === d ? "bg-usdc text-white" : "bg-white/5 text-white/60")
                }
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="glass mt-4 p-3 text-xs text-white/50">
          You will be the resolver of this market.
          <br />
          <span className="text-yellow-300/80">
            Subsidy needed: ~{subsidy} USDC (returned after resolution).
          </span>
          {isConnected && (
            <span className={enoughBalance ? "text-white/40" : "text-no"}>
              <br />
              Your balance: {balanceNum.toFixed(2)} USDC
              {!enoughBalance && " — not enough!"}
            </span>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={busy || (isConnected && !enoughBalance)}
          className="mt-4 w-full rounded-2xl bg-usdc py-4 font-semibold text-white disabled:opacity-40"
        >
          {busy
            ? "Creating..."
            : isConnected && !enoughBalance
            ? "Not enough USDC"
            : "Create Market"}
        </button>
      </div>
    </div>
  );
}
