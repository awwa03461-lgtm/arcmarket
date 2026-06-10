"use client";

// Reown AppKit registers a global <appkit-button> web component.

export function ConnectButton() {
  return (
    <div className="flex items-center">
      {/* @ts-expect-error Reown web component */}
      <appkit-button balance="hide" size="sm" />
    </div>
  );
}
