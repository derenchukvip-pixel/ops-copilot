import type { ReactNode } from "react";
import type { Tone } from "@/domain/audit";

const TONE_CLASSES: Record<Tone, string> = {
  positive: "bg-positive-tint text-positive",
  warning: "bg-warning-tint text-warning",
  neutral: "bg-neutral-tint text-neutral",
  negative: "bg-negative-tint text-negative",
};

interface BadgeProps {
  tone: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * State badge: icon, word, colour — three carriers of the same meaning at once.
 *
 * The word is not decoration on top of the colour. Roughly one man in twelve cannot separate
 * red from green, and these are the badges where being wrong is expensive, so the text is the
 * primary channel and the colour is the reinforcement.
 */
export function Badge({ tone, icon, children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
        "label-caps",
        TONE_CLASSES[tone],
        className,
      ].join(" ")}
    >
      {icon ? (
        <span aria-hidden="true" className="flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
