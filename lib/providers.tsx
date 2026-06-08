"use client";

import { ReactNode, useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { arcTestnet } from "./chain";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "YOUR_PROJECT_ID";

const wagmiAdapter = new WagmiAdapter({
  networks: [arcTestnet as any],
  projectId,
  ssr: true,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

// راه‌اندازی Reown AppKit
createAppKit({
  adapters: [wagmiAdapter],
  networks: [arcTestnet as any],
  projectId,
  metadata: {
    name: "Prediction Arc",
    description: "بازار پیش‌بینی روی Arc Testnet",
    url: "https://prediction-arc.vercel.app",
    icons: ["https://prediction-arc.vercel.app/icon.png"],
  },
  features: { analytics: false, email: true, socials: ["google", "x"] },
});

const queryClient = new QueryClient();

/**
 * shim بحرانی برای Telegram Mini App:
 * WebView داخلی تلگرام در Android نمی‌تواند deep-link های wc:// و metamask://
 * را باز کند (ERR_UNKNOWN_URL_SCHEME). این shim آن‌ها را به لینک‌های https
 * تبدیل می‌کند و از طریق Telegram.WebApp.openLink باز می‌کند.
 */
function useTelegramWalletShim() {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    tg.ready();
    tg.expand();

    const originalOpen = window.open.bind(window);
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      const u = typeof url === "string" ? url : url?.toString() ?? "";
      if (u.startsWith("metamask://")) {
        tg.openLink(u.replace("metamask://", "https://metamask.app.link/"));
        return null;
      }
      if (u.startsWith("https://")) {
        tg.openLink(u);
        return null;
      }
      // wc:// و سایر اسکیم‌ها → تلاش با openLink
      if (u.startsWith("wc:") || u.includes("://")) {
        try { tg.openLink(u); return null; } catch { /* fallthrough */ }
      }
      return originalOpen(u, target ?? "_blank", features);
    }) as typeof window.open;

    return () => {
      window.open = originalOpen;
    };
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useTelegramWalletShim();
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
