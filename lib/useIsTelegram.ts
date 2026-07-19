"use client";

import { useEffect, useState } from "react";

/**
 * True when the app is actually running inside Telegram.
 *
 * The Telegram SDK script loads on every page, so `window.Telegram.WebApp`
 * exists in a plain browser too — checking for it is not enough. What differs
 * is the values it reports:
 *
 *   in a browser   initData is ""          platform is "unknown"
 *   in Telegram    initData is populated   platform is "android" / "ios" /
 *                                          "tdesktop" / "weba" ...
 *
 * Starts as `null` so nothing renders before we know.
 */
export function useIsTelegram(): boolean | null {
  const [inTelegram, setInTelegram] = useState<boolean | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;

    if (!tg) {
      setInTelegram(false);
      return;
    }

    const hasInitData =
      typeof tg.initData === "string" && tg.initData.length > 0;
    const platform = typeof tg.platform === "string" ? tg.platform : "";
    const realPlatform = platform !== "" && platform !== "unknown";

    setInTelegram(hasInitData || realPlatform);
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
 *
 * Returns `null` for the first render, before we know where we're running.
 * Render nothing until then, or the wrong layout flashes into view.
 */
export function useDesktopShell(): boolean | null {
  const inTelegram = useIsTelegram();
  if (inTelegram === null) return null;
  return !inTelegram;
}
