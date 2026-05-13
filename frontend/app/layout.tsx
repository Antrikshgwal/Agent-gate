import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "AgentGate — x402 gateway on Kite",
  description:
    "Permissionless service discovery and pay-per-call x402 routing for AI agents on Kite Chain.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Nav />
        <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">{children}</main>
        <footer className="mx-auto max-w-6xl border-t border-line px-6 py-8 text-sm text-ink-dim">
          Built on Kite Chain · x402 v2 over EIP-3009 · payments routed via
          Pieverse facilitator
        </footer>
      </body>
    </html>
  );
}
