"use client";

import { ReactNode, useState, useEffect } from "react";

/**
 * DesktopShell — the browser-only frame.
 *
 * Wraps the existing tab content in a sidebar layout. Every child component
 * keeps working untouched: the shell redefines the theme tokens on `.dsk`,
 * so cards, buttons and text pick up the new palette automatically.
 */

type TabId = string;

export type ShellTab = { id: TabId; label: string };

/**
 * Nav groups. The grouping isn't decorative — it splits seven destinations by
 * what you actually came to do, which is why a flat row of seven tabs stopped
 * working.
 */
const GROUPS: { title: string; items: { id: TabId; label: string; glyph: string }[] }[] = [
  {
    title: "Predict",
    items: [
      { id: "markets", label: "Markets", glyph: "◈" },
      { id: "daily", label: "Daily", glyph: "◷" },
      { id: "portfolio", label: "Portfolio", glyph: "▤" },
    ],
  },
  {
    title: "Move money",
    items: [
      { id: "send", label: "Send", glyph: "↗" },
      { id: "swap", label: "Swap", glyph: "⇄" },
    ],
  },
  {
    title: "Make",
    items: [
      { id: "nft", label: "Mint NFT", glyph: "◆" },
      { id: "chat", label: "Assistant", glyph: "✳" },
    ],
  },
];

/** Section copy. Tells you where you are and what this screen is for. */
const HERO: Record<TabId, { eyebrow: string; title: string; sub: string }> = {
  markets: {
    eyebrow: "Prediction markets",
    title: "Trade on what happens next.",
    sub: "Buy the outcome you believe in. Prices move with demand, so the odds are the crowd's live estimate — and you can sell before it resolves.",
  },
  daily: {
    eyebrow: "Daily contest",
    title: "Three calls. One day. Free to enter.",
    sub: "Read the market on BTC, ETH and SOL. Get all three right and split the pool. Settled on-chain by Pyth — nobody decides the outcome.",
  },
  portfolio: {
    eyebrow: "Your positions",
    title: "Everything you're holding.",
    sub: "Open positions, resolved markets, and anything waiting to be claimed.",
  },
  send: {
    eyebrow: "Transfers",
    title: "Move USDC in seconds.",
    sub: "Send stablecoins to any address on Arc. Fees are paid in USDC, so there's no second token to keep around.",
  },
  swap: {
    eyebrow: "Exchange",
    title: "Swap between stablecoins.",
    sub: "USDC and EURC, priced by an on-chain pool. No order book, no counterparty.",
  },
  nft: {
    eyebrow: "Create",
    title: "Deploy your own NFT in one click.",
    sub: "Upload an image, name it, and tap once. Your collection goes live on Arc with the first token minted to you.",
  },
  chat: {
    eyebrow: "Assistant",
    title: "Ask anything.",
    sub: "Your wallet is your login. One payment unlocks it — no email, no password, no card.",
  },
};

const FALLBACK_HERO = {
  eyebrow: "Prediction Arc",
  title: "Markets for what happens next.",
  sub: "Built on Arc, settled in USDC.",
};

export function DesktopShell({
  tab,
  setTab,
  children,
  connectSlot,
}: {
  tab: TabId;
  setTab: (t: any) => void;
  children: ReactNode;
  /** Drop your existing <ConnectButton /> in here. */
  connectSlot?: ReactNode;
}) {
  const hero = HERO[tab] ?? FALLBACK_HERO;
  const [navOpen, setNavOpen] = useState(false);

  // Close the drawer whenever the section changes.
  useEffect(() => {
    setNavOpen(false);
  }, [tab]);

  // Don't let the page scroll behind an open drawer.
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  return (
    <div className={"dsk" + (navOpen ? " nav-open" : "")}>
      {/* backdrop, only ever visible on narrow screens */}
      <button
        className="dsk-scrim"
        onClick={() => setNavOpen(false)}
        aria-label="Close menu"
        tabIndex={navOpen ? 0 : -1}
      />

      {/* ---------------------------------------------------- sidebar */}
      <aside className="dsk-rail">
        <div className="dsk-brand">
          <span className="dsk-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path
                d="M3 19 L12 5 L21 19"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M7.5 14.5 H16.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="dsk-wordmark">
            Prediction<em>Arc</em>
          </span>
        </div>

        <nav className="dsk-nav" aria-label="Sections">
          {GROUPS.map((group) => (
            <div key={group.title} className="dsk-group">
              <p className="dsk-group-title">{group.title}</p>
              {group.items.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={"dsk-link" + (active ? " is-active" : "")}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="dsk-glyph" aria-hidden="true">
                      {item.glyph}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="dsk-rail-foot">
          <p className="dsk-group-title">Resources</p>
          <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="dsk-out">
            Get testnet USDC
          </a>
          <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" className="dsk-out">
            Arc explorer
          </a>
        </div>
      </aside>

      {/* ------------------------------------------------------ main */}
      <div className="dsk-main">
        <header className="dsk-top">
          <button
            className="dsk-burger"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            aria-expanded={navOpen}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <span className="dsk-chip">
            <i className="dsk-pulse" aria-hidden="true" />
            Arc Testnet
          </span>
          <span className="dsk-fee">Fees paid in USDC</span>
          <div className="dsk-connect">{connectSlot}</div>
        </header>

        <div className="dsk-scroll">
          <section className="dsk-hero">
            <p className="dsk-eyebrow">{hero.eyebrow}</p>
            <h1 className="dsk-title">{hero.title}</h1>
            <p className="dsk-sub">{hero.sub}</p>
          </section>

          <main className="dsk-content">{children}</main>

          <footer className="dsk-foot">
            <span>Testnet — balances carry no real value.</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
