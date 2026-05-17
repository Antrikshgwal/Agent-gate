"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CodeBlockCopyable({
  code,
  small,
}: {
  code: string;
  small?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          toast.success("Copied");
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 z-10 rounded-md border border-white/[0.06] bg-background/80 p-1.5 text-muted-foreground backdrop-blur transition hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <pre
        className={cn(
          "overflow-auto rounded-xl border border-white/[0.06] bg-black/40 p-4 font-mono leading-relaxed",
          small ? "max-h-64 text-[11px]" : "max-h-96 text-xs",
        )}
      >
        {code}
      </pre>
    </div>
  );
}
