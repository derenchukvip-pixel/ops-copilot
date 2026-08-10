import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "quiet";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
}

/**
 * Height 48 and radius 14 come from the shared spec, and the 48 is not only for looks: it
 * clears the 44pt minimum touch target, which matters because the operator may well be
 * approving something from a phone.
 *
 * `danger` is an outline, not a fill. A solid red button next to a solid blue one reads as
 * the pair of equals it is not — reject is the rarer, heavier choice and should require a
 * fractionally more deliberate click.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-bright active:bg-brand disabled:bg-neutral disabled:text-white/70",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-subtle disabled:text-ink-muted",
  danger:
    "bg-surface text-negative border border-negative/40 hover:bg-negative-tint hover:border-negative disabled:text-negative/50",
  quiet: "bg-transparent text-ink-muted hover:text-ink hover:bg-surface-subtle",
};

export function Button({
  variant = "secondary",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      // `aria-busy` is what tells a screen reader the press was registered; the spinner
      // alone communicates nothing to anyone not looking at the pixels.
      aria-busy={loading || undefined}
      className={[
        "inline-flex h-12 items-center justify-center gap-2 rounded-[14px] px-6",
        "text-body font-semibold whitespace-nowrap",
        "transition-colors duration-[120ms] ease-out",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
