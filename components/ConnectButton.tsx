"use client";

// Reown AppKit یک web-component سراسری به نام <appkit-button> ثبت می‌کند.

import { useAccount } from "wagmi";

export function ConnectButton() {
  const { address, isConnected } = useAccount();

  return (
    <div className="flex items-center gap-2">
      {isConnected && address && (
        <span className="num text-xs text-white/60">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
      )}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(() => {
        const Btn = "appkit-button" as any;
        return <Btn balance="hide" size="sm" />;
      })()}
    </div>
  );
}
