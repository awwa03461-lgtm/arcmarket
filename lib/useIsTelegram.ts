"use client";

import { useEffect, useState } from "react";

/**
 * True when the app is running inside Telegram's WebView.
 *
 * The Mini App keeps its existing mobile layout untouched; only the desktop
 * browser gets the shell. Starts as `null` so nothing flashes before we know.
 */
export function useIsTelegram(): boolean | null {
  const [inTelegram, setInTelegram] = useState<boolean | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    setInTelegram(!!tg?.initData || !!tg?.platform);
  }, []);

  return inTelegram;
}

/** True on screens wide enough for the sidebar layout. */
export function useIsWide(min = 1024): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${min}px)`);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [min]);

  return wide;
}

/**
 * The one check the page needs: show the browser shell?
 *
 * Any screen size, as long as we're not inside Telegram. The shell itself is
 * responsive — the sidebar becomes a drawer on narrow screens.
 */
export function useDesktopShell(): boolean {
  const inTelegram = useIsTelegram();
  return inTelegram === false;
}
