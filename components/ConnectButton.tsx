"use client";

// Reown AppKit registers a global <appkit-button> web component.

export function ConnectButton() {
  const Btn = "appkit-button" as any;
  return (
    <div className="flex items-center">
      <Btn balance="hide" size="sm" />
    </div>
  );
}
