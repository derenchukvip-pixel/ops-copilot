import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Raised cards get the one shadow in the system. Flat cards get a border and nothing else. */
  raised?: boolean;
}

export function Card({ children, raised = false, className = "", ...rest }: CardProps) {
  return (
    <div
      className={[
        "rounded-[14px] border border-line bg-surface",
        raised ? "shadow-(--shadow-raised)" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * The label/value pair from the shared spec: uppercase label above, value below, no rule
 * between them — the letter-spacing on the caps already separates the two.
 */
export function Field({ label, children, className = "" }: FieldProps) {
  return (
    <div className={className}>
      <div className="label-caps text-ink-muted">{label}</div>
      <div className="mt-1 text-body font-semibold break-words text-ink">{children}</div>
    </div>
  );
}
