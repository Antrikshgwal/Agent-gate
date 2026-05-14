import { cn } from "@/lib/cn";

export function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: "default" | "success" | "warn" | "bad" | "muted";
  className?: string;
  children: React.ReactNode;
}) {
  const styles = {
    default: "border-line bg-bg-2 text-ink-muted",
    success: "border-good/20 bg-good/10 text-good",
    warn: "border-warn/20 bg-warn/10 text-warn",
    bad: "border-bad/20 bg-bad/10 text-bad",
    muted: "border-line bg-bg-1 text-ink-dim",
  }[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        styles,
        className,
      )}
    >
      {children}
    </span>
  );
}
