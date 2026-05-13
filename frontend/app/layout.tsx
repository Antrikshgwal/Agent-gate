import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AgentGate — on-chain marketplace for AI-agent API access",
  description:
    "Providers stake to resell legacy APIs on a pay-per-call basis. Agents discover, pay, and earn reputation — settled in USDC on Kite Chain via x402.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">{children}</main>
          <footer className="mx-auto max-w-6xl border-t border-line px-6 py-8 text-sm text-ink-dim">
            Built on Kite Chain · x402 v2 over EIP-3009 · payments routed via
            Pieverse facilitator
          </footer>
        </Providers>
      </body>
    </html>
  );
}
