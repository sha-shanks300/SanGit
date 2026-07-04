import { cn } from "@/lib/utils";

/* Primitives per DESIGN.md component spec. */

type ButtonVariant = "primary" | "secondary" | "tertiary";

export function buttonClasses(variant: ButtonVariant = "primary") {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-button font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  switch (variant) {
    case "primary":
      return cn(base, "bg-primary text-white hover:bg-primary-hover active:bg-primary-focus");
    case "secondary":
      return cn(base, "bg-surface-1 text-ink border border-hairline hover:bg-surface-2 hover:border-hairline-strong");
    case "tertiary":
      return cn(base, "bg-transparent text-ink hover:bg-surface-1");
  }
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={cn(buttonClasses(variant), className)} {...props} />;
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md bg-surface-1 border border-hairline px-3 py-2 text-body text-ink placeholder:text-ink-tertiary",
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface-1 border border-hairline p-6",
        className
      )}
      {...props}
    />
  );
}

/** Protagonist panel — 16px radius, surface-1, top-edge highlight. */
export function Panel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "panel-edge rounded-xl bg-surface-1 border border-hairline p-6",
        className
      )}
      {...props}
    />
  );
}

export function StatusBadge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "success" | "accent" | "processing";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-caption",
        tone === "neutral" && "text-ink-muted",
        tone === "success" && "text-success",
        tone === "accent" && "text-primary-hover",
        tone === "processing" && "text-ink-subtle animate-pulse",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Eyebrow({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-eyebrow font-medium uppercase tracking-[0.4px] text-ink-subtle",
        className
      )}
      {...props}
    />
  );
}
