import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "./providers";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "AgentGate — the on-chain marketplace for AI agents",
  description:
    "Pay-per-call API access for autonomous agents. Settled in USDC on Kite Chain via x402.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(GeistSans.variable, GeistMono.variable, "dark")}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen font-sans antialiased"
        style={
          {
            "--font-sans": GeistSans.style.fontFamily,
            "--font-mono": GeistMono.style.fontFamily,
            "--font-display": GeistSans.style.fontFamily,
          } as React.CSSProperties
        }
      >
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-mesh" />
          <div className="absolute inset-0 bg-grid-faint" />
        </div>

        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">{children}</main>
          <footer className="border-t border-white/[0.06]">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground">
              <span>
                Built on Kite Chain · x402 v2 · settled in USDC via Pieverse
              </span>
              <span className="font-mono text-[10px] opacity-60">
                press <kbd className="rounded border border-white/10 px-1.5 py-0.5">⌘K</kbd> anywhere
              </span>
            </div>
          </footer>
          <Toaster />
          <CommandPalette />
        </Providers>
      </body>
    </html>
  );
}
