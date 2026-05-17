import Link from "next/link";
import { WalletButton } from "./wallet-button";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-glow" />
          <span className="font-semibold tracking-tight">AgentGate</span>
          <span className="ml-1 rounded border border-line px-1.5 py-px text-[10px] uppercase tracking-wider text-ink-dim">
            testnet
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-ink-muted">
          <Link href="/services" className="hover:text-ink">
            Services
          </Link>
          <Link href="/playground" className="hover:text-ink">
            Playground
          </Link>
          <Link href="/agents" className="hover:text-ink">
            For agents
          </Link>
          <Link href="/register" className="hover:text-ink">
            Register
          </Link>
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
