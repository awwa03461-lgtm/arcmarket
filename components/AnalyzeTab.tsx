"use client";

import { useState } from "react";

// Path A: the server-side agent pays per analysis via Circle Gateway.
// The user just types a question and taps Analyze — no wallet needed here.

export function AnalyzeTab({ presetQuestion }: { presetQuestion?: string }) {
  const [question, setQuestion] = useState(presetQuestion || "");
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [status, setStatus] = useState("");
  const [paymentTx, setPaymentTx] = useState("");

  function haptic(t: "success" | "error") {
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
  }

  async function analyze() {
    if (!question.trim()) {
      setStatus("Type a market question first.");
      return;
    }
    setBusy(true);
    setAnalysis("");
    setPaymentTx("");
    setStatus("Agent is paying $0.01 and researching...");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) {
        haptic("error");
        setStatus("Error: " + (data.error || "failed") + (data.detail ? " — " + data.detail : ""));
        return;
      }
      setAnalysis(data.analysis || "No analysis.");
      if (data.paymentTx) setPaymentTx(data.paymentTx);
      setStatus("");
      haptic("success");
    } catch (e: any) {
      haptic("error");
      setStatus("Error: " + (e?.message || "failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">🤖</span>
        <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
          AI Market Analysis
        </h3>
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--ink-dim)" }}>
        A neutral, research-backed briefing on any market. Our agent pays $0.01
        USDC per analysis via Circle Gateway nanopayments — gasless, on Arc.
      </p>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. Will Bitcoin close above $120k this month?"
        rows={3}
        className="mt-4 w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: "var(--surface-2)", color: "var(--ink)" }}
      />

      <button
        onClick={analyze}
        disabled={busy}
        className="mt-3 w-full rounded-2xl py-4 font-semibold text-white disabled:opacity-40"
        style={{ background: "var(--usdc)" }}
      >
        {busy ? "Analyzing..." : "🔍 Analyze"}
      </button>

      {status && (
        <div className="mt-3 text-center text-xs" style={{ color: "var(--ink-dim)" }}>
          {status}
        </div>
      )}

      {analysis && (
        <div className="glass-2 mt-4 p-4 text-sm" style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>
          {analysis}
          {paymentTx && (
            <a
              href={"https://testnet.arcscan.app/tx/" + paymentTx}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-[10px] underline"
              style={{ color: "var(--usdc)" }}
            >
              Paid via Circle Gateway · view tx
            </a>
          )}
          <div className="mt-2 text-[10px]" style={{ color: "var(--ink-dim)" }}>
            Informational only. Not betting advice.
          </div>
        </div>
      )}
    </div>
  );
}
