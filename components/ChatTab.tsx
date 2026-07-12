"use client";

import { useState, useEffect, useRef } from "react";
import {
  useAccount,
  useWriteContract,
  usePublicClient,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";

const USDC = "0x3600000000000000000000000000000000000000" as `0x${string}`;
const TREASURY = "0x2326464c8d8EEF23A9Ae30B27CEa4Aa8F831b626" as `0x${string}`;
const PRICE = "1"; // 1 USDC

const ERC20 = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "o", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

type Msg = { role: "user" | "assistant"; content: string };

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

export function ChatTab() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [paid, setPaid] = useState<boolean | null>(null);
  const [remaining, setRemaining] = useState(5);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: bal } = useReadContract({
    address: USDC,
    abi: ERC20,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const usdc = bal ? Number(formatUnits(bal as bigint, 6)) : 0;

  // check status when wallet connects
  useEffect(() => {
    if (!address) {
      setPaid(null);
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", address }),
        });
        const d = await r.json();
        setPaid(!!d.paid);
        setRemaining(d.remaining ?? 5);
      } catch {
        setPaid(false);
      }
    })();
  }, [address]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function activate() {
    if (!address || !publicClient) return;
    setActivating(true);
    setErr("");
    try {
      const hash = await writeContractAsync({
        address: USDC,
        abi: ERC20,
        functionName: "transfer",
        args: [TREASURY, parseUnits(PRICE, 6)],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", address, txHash: hash }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Activation failed");
      setPaid(true);
      haptic("success");
    } catch (e: any) {
      haptic("error");
      setErr(e?.shortMessage || e?.message || "Failed");
    } finally {
      setActivating(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy || !address) return;
    setErr("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", address, messages: next }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "Failed");
        setMessages(messages); // roll back
        return;
      }
      setMessages([...next, { role: "assistant", content: d.reply }]);
      setRemaining(d.remaining ?? 0);
      haptic("success");
    } catch (e: any) {
      setErr(e?.message || "Failed");
      setMessages(messages);
    } finally {
      setBusy(false);
    }
  }

  // ---------- not connected ----------
  if (!isConnected) {
    return (
      <div className="glass p-8 text-center">
        <div className="text-4xl">💬</div>
        <h3 className="mt-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Arc Assistant
        </h3>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
          Connect your wallet to start chatting
        </p>
      </div>
    );
  }

  // ---------- locked (not paid) ----------
  if (paid === false) {
    return (
      <div className="glass p-8 text-center">
        <div className="text-4xl">🔒</div>
        <h3 className="mt-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Unlock Arc Assistant
        </h3>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
          A one-time <span className="num font-semibold" style={{ color: "var(--usdc)" }}>1 USDC</span> payment
          unlocks the AI chat forever. You get <b>5 questions per day</b>.
        </p>

        <div className="glass-2 mt-4 p-3 text-xs" style={{ color: "var(--ink-dim)" }}>
          Your balance: <span className="num" style={{ color: "var(--ink)" }}>{usdc.toFixed(2)} USDC</span>
        </div>

        <button
          onClick={activate}
          disabled={activating || usdc < 1}
          className="mt-4 w-full rounded-2xl py-4 font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--usdc)" }}
        >
          {activating ? "Activating..." : usdc < 1 ? "Need 1 USDC" : "Pay 1 USDC & Unlock"}
        </button>

        {err && (
          <div className="mt-3 text-xs" style={{ color: "var(--no)" }}>{err}</div>
        )}
        <p className="mt-3 text-[10px]" style={{ color: "var(--ink-dim)" }}>
          Testnet USDC on Arc · one-time payment
        </p>
      </div>
    );
  }

  // ---------- loading status ----------
  if (paid === null) {
    return (
      <div className="glass p-8 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
        Loading...
      </div>
    );
  }

  // ---------- chat (unlocked) ----------
  return (
    <div className="glass flex flex-col" style={{ height: "70vh" }}>
      {/* header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-semibold" style={{ color: "var(--ink)" }}>
            Arc Assistant
          </span>
        </div>
        <span
          className="num rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{
            background: remaining > 0 ? "var(--surface-2)" : "#f25e7a22",
            color: remaining > 0 ? "var(--ink-dim)" : "#f25e7a",
          }}
        >
          {remaining}/5 left today
        </span>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="mt-6 text-center">
            <div className="text-3xl">✨</div>
            <p className="mt-2 text-sm font-medium" style={{ color: "var(--ink)" }}>
              How can I help you today?
            </p>
            <div className="mt-4 space-y-2">
              {[
                "What is a prediction market?",
                "Explain Arc and USDC gas",
                "How do I read the odds?",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="block w-full rounded-xl px-3 py-2 text-left text-xs"
                  style={{ background: "var(--surface-2)", color: "var(--ink-dim)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm"
              style={
                m.role === "user"
                  ? { background: "var(--usdc)", color: "#fff" }
                  : { background: "var(--surface-2)", color: "var(--ink)", whiteSpace: "pre-wrap" }
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: "var(--surface-2)" }}
            >
              <span className="inline-flex gap-1">
                <span className="dot" />
                <span className="dot" style={{ animationDelay: "0.15s" }} />
                <span className="dot" style={{ animationDelay: "0.3s" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {err && (
        <div className="px-4 pb-2 text-center text-xs" style={{ color: "var(--no)" }}>
          {err}
        </div>
      )}

      {/* input */}
      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={remaining > 0 ? "Ask anything..." : "Daily limit reached"}
            disabled={remaining <= 0 || busy}
            rows={1}
            className="flex-1 resize-none rounded-2xl px-4 py-3 text-sm outline-none disabled:opacity-50"
            style={{ background: "var(--surface-2)", color: "var(--ink)", maxHeight: "100px" }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || busy || remaining <= 0}
            className="rounded-full p-3 text-white disabled:opacity-30"
            style={{ background: "var(--usdc)" }}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>

      <style jsx>{`
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--ink-dim);
          display: inline-block;
          animation: blink 1.2s infinite;
        }
        @keyframes blink {
          0%, 60%, 100% { opacity: 0.25; }
          30% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
