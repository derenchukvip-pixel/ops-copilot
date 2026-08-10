"use client";

import { FlaskConical, RotateCcw } from "lucide-react";
import { useState } from "react";
import { getDemoApi, IS_DEMO } from "@/api";

/**
 * Says, on every screen, that the numbers below are fixtures.
 *
 * The published demo has no backend: the agent costs money at Anthropic per ticket, and a
 * public URL is not somewhere to put that. So the data is hand-written — and a portfolio piece
 * that quietly showed invented figures as if they were measurements would be worth less than
 * one with no demo at all. Hence a banner that does not go away.
 *
 * The two switches expose states that are otherwise hard to reach on purpose. They are the
 * genuine code paths — the conflict switch makes the demo client throw the same 409 the API
 * throws when `transitionIfPending` matches no row — not a mock-up of them.
 */
export function DemoBanner() {
  const demoApi = getDemoApi();
  const [flags, setFlags] = useState(() => demoApi?.flags ?? {
    simulateConflict: false,
    simulateOffline: false,
  });

  if (!IS_DEMO || !demoApi) {
    return null;
  }

  return (
    <div className="border-b border-warning/30 bg-warning-tint">
      <div className="mx-auto max-w-[880px] px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <p className="flex min-w-0 items-start gap-2 text-caption text-warning">
            <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong className="font-semibold">Demo data.</strong> No backend is attached.
              Tickets and decisions below are fixtures shaped like real API responses, and the
              dashboard figures are computed from them — none of it is a measurement of anything.
            </span>
          </p>
        </div>

        <details className="mt-2">
          <summary className="inline-block cursor-pointer list-none text-caption font-semibold text-warning underline decoration-warning/40 underline-offset-4">
            Demo controls
          </summary>
          <div className="mt-3 flex flex-col gap-3 rounded-[8px] border border-warning/30 bg-surface p-4 text-caption text-ink">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                aria-label="Make the next approve or reject fail with a 409 conflict"
                checked={flags.simulateConflict}
                onChange={(event) => {
                  demoApi.setSimulateConflict(event.target.checked);
                  setFlags(demoApi.flags);
                }}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
              />
              <span>
                <span className="font-semibold">Another operator gets there first.</span> The next
                approve or reject returns 409, the way the API does when the action has already
                left PENDING.
              </span>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                aria-label="Make every API call fail as if the backend were unreachable"
                checked={flags.simulateOffline}
                onChange={(event) => {
                  demoApi.setSimulateOffline(event.target.checked);
                  setFlags(demoApi.flags);
                }}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
              />
              <span>
                <span className="font-semibold">API unreachable.</span> Every call fails, so you
                can see the error and rollback behaviour.
              </span>
            </label>

            <button
              type="button"
              onClick={() => {
                demoApi.reset();
                setFlags(demoApi.flags);
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 self-start rounded-[8px] border border-line px-3 py-2 font-semibold text-ink hover:bg-surface-subtle"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Reset the demo data
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
