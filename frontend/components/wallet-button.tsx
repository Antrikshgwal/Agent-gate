"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

/// Replaces the static "Connect Wallet" pill in the nav with RainbowKit's
/// stock connect button. Renders nothing odd during SSR — RainbowKit handles
/// hydration internally.
export function WalletButton() {
  return (
    <ConnectButton
      showBalance={false}
      chainStatus="icon"
      accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
    />
  );
}
