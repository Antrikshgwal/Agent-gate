import React from "react";
import { truncHex, explorerAddress, explorerTx } from "@/lib/format";

export function HashLink({
  value,
  kind,
  truncate = true,
}: {
  value: string;
  kind: "address" | "tx";
  truncate?: boolean;
}) {
  const href = kind === "tx" ? explorerTx(value) : explorerAddress(value);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-mono text-xs text-ink-muted underline decoration-line decoration-dotted underline-offset-4 hover:text-accent"
    >
      {truncate ? truncHex(value) : value}
    </a>
  );
}
