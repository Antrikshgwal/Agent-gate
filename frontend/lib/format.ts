import { formatUnits } from "viem";
import { env } from "./env";

export function formatUsdc(amount: bigint, decimals = 6): string {
  const s = formatUnits(amount, decimals);
  // Strip trailing zeros after the decimal, but keep at least 2 places.
  const [whole, frac = ""] = s.split(".");
  const trimmed = frac.replace(/0+$/, "").padEnd(2, "0");
  return trimmed ? `${whole}.${trimmed}` : whole!;
}

export function truncHex(hex: string, lead = 6, tail = 4): string {
  if (!hex || hex.length < lead + tail + 2) return hex;
  return `${hex.slice(0, 2 + lead)}…${hex.slice(-tail)}`;
}

export function explorerAddress(address: string): string {
  return `${env.explorer}/address/${address}`;
}

export function explorerTx(hash: string): string {
  return `${env.explorer}/tx/${hash}`;
}

export function uptimePct(total: bigint, success: bigint): number {
  if (total === 0n) return 0;
  return Number((success * 10000n) / total) / 100;
}

export function relativeTime(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ageDays(unixSeconds: number): number {
  return Math.floor((Date.now() / 1000 - unixSeconds) / 86400);
}
