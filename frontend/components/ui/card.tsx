import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-bg-1/60 p-5 backdrop-blur",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-xs uppercase tracking-wider text-ink-dim">{children}</div>;
}

export function CardValue({ children }: { children: React.ReactNode }) {
  return <div className="text-3xl font-semibold tracking-tight">{children}</div>;
}

export function CardSub({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-xs text-ink-muted">{children}</div>;
}
