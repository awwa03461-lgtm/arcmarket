"use client";

import { useState, useEffect } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // در اولین بارگذاری، ترجیح ذخیره‌شده یا سیستم را بخوان
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage?.getItem("theme")
        : null;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : !!prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage?.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="glass-2 flex h-9 w-9 items-center justify-center text-base"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
