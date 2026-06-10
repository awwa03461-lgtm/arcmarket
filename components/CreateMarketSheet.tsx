"use client";

import { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { FACTORY_ABI, ERC20_ABI } from "@/lib/abis";
import { FACTORY_ADDRESS, USDC_ADDRESS, USDC_DECIMALS } from "@/lib/chain";

function haptic(type: "success" | "error") {
  const tg = (window as any).Telegram?.WebApp;
  tg?.HapticFeedback?.notificationOccurred?.(type);
}

export function CreateMarketSheet({
  prefill,
  onClose,
}: {
  prefill?: string;
  onClose: () => void;
}) {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [question, setQuestion] = useState(prefill || "");
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!isConnected) {
      (window as any).Telegram?.WebApp?.showAlert?.("Connect wallet first");
      return;
    }
    if (question.trim().length < 8) {
      (window as any).Telegram?.WebApp?.showAlert?.("Question is too short");
      return;
    }
    setBusy(true);
    try {
      const closeTime = BigInt(
        Math.floor(Date.now() / 1000) + Number(days || "7") * 86400
      );

      // یارانهٔ لازم برای B_MIN=200, دو نتیجه ≈ 138.63 USDC. کمی بیشتر approve می‌کنیم.
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [FACTORY_ADDRESS, parseUnits("200", USDC_DECIMALS)],
      });
      await new Promise((r) => setTimeout(r, 2500));

      await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createMarket",
        args: [question.trim(), ["YES", "NO"], closeTime],
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
        className="glass w-full rounded-b-none p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h3 className="text-base font-semibold">➕ Create market جدید</h3>

        <div className="mt-4">
          <label className="text-xs text-white/50">سؤال بازار</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="e.g. Will Arc launch mainnet by end of 2026?"
            className="mt-1 w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm outline-none"
          />
        </div>

        <div className="mt-4">
          <label className="text-xs text-white/50">مدت بازار (روز)</label>
          <div className="mt-1 flex gap-2">
            {["1", "7", "30"].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`num flex-1 rounded-xl py-2 text-sm transition ${
                  days === d ? "bg-usdc text-white" : "bg-white/5 text-white/60"
                }`}
              >
                {d} روز
              </button>
            ))}
          </div>
        </div>

        <div className="glass mt-4 p-3 text-xs text-white/50">
          نتایج: YES / NO · شما به‌عنوان سازنده، حل‌کنندهٔ این بازار خواهید بود.
          <br />
          <span className="text-yellow-300/80">
            ⚠️ Create market به ~۱۳۹ USDC یارانهٔ اولیه نیاز دارد (برای تضمین نقدینگی).
            این مبلغ پس از تسویه و پرداخت برندگان، به شما بازمی‌گردد.
          </span>
        </div>

        <button
          onClick={handleCreate}
          disabled={busy}
          className="mt-4 w-full rounded-2xl bg-usdc py-4 font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Creating..." : "Create market"}
        </button>
      </div>
    </div>
  );
}
