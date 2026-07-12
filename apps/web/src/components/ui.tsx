import { cn } from "@/lib/utils";

/* Primitives per DESIGN.md component spec. */

type ButtonVariant = "primary" | "secondary" | "tertiary";

export function buttonClasses(variant: ButtonVariant = "primary") {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-5 py-2.5 text-button font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  switch (variant) {
    case "primary":
      return cn(base, "bg-primary text-white cta-hover-gradient active:bg-primary-active");
    case "secondary":
      return cn(base, "bg-transparent text-ink border border-ink hover:bg-surface-1");
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
        "w-full rounded-sm bg-canvas border border-hairline px-4 py-2.5 text-body text-ink placeholder:text-ink-tertiary",
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

/** Protagonist panel — sharp corners, surface-1, hairline border. */
export function Panel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl bg-surface-1 border border-hairline p-6",
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
        "inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 font-mono text-caption uppercase tracking-[0.28px]",
        tone === "neutral" && "text-ink-muted",
        tone === "success" && "text-success",
        tone === "accent" && "text-primary",
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
        "font-mono text-eyebrow uppercase text-ink-subtle",
        className
      )}
      {...props}
    />
  );
}
