"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { QueueNotice } from "@/hooks/useApprovalQueue";
import type { Tone } from "@/domain/audit";

const TONE_STYLES: Record<Tone, { box: string; icon: ReactNode }> = {
  positive: {
    box: "border-positive/30 bg-positive-tint text-positive",
    icon: <CheckCircle2 aria-hidden="true" className="size-5" />,
  },
  warning: {
    box: "border-warning/30 bg-warning-tint text-warning",
    icon: <AlertTriangle aria-hidden="true" className="size-5" />,
  },
  negative: {
    box: "border-negative/30 bg-negative-tint text-negative",
    icon: <XCircle aria-hidden="true" className="size-5" />,
  },
  neutral: {
    box: "border-line bg-neutral-tint text-neutral",
    icon: <Info aria-hidden="true" className="size-5" />,
  },
};

interface NoticeBannerProps {
  notice: QueueNotice;
  onDismiss: () => void;
}

/**
 * The outcome of the last write.
 *
 * `alert` rather than `status` for failures, because a rollback that a screen reader user is
 * not told about looks like the click simply did nothing.
 */
export function NoticeBanner({ notice, onDismiss }: NoticeBannerProps) {
  const style = TONE_STYLES[notice.tone];

  return (
    <div
      role={notice.tone === "negative" ? "alert" : "status"}
      className={["flex items-start gap-3 rounded-[14px] border p-4", style.box].join(" ")}
    >
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">{notice.title}</p>
        <p className="mt-0.5 text-caption">{notice.body}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss this message"
        className="-m-2 shrink-0 rounded-[8px] p-2 hover:bg-black/5"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
