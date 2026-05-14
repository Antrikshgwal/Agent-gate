import Link from "next/link";
import { cn } from "@/lib/cn";

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  className?: string;
  children: React.ReactNode;
}) {
  const styles =
    variant === "primary"
      ? "bg-accent text-bg hover:bg-accent-hover"
      : "border border-line text-ink hover:border-accent/40 hover:text-accent";
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
        styles,
        className,
      )}
    >
      {children}
    </Link>
  );
}
