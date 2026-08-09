"use client";

import { useEffect, useMemo, useState } from "react";
import { Inbox, PlugZap, RefreshCw, Settings } from "lucide-react";
import { API_BASE_URL, getOpsApi, IS_DEMO, liveConfigError } from "@/api";
import { NetworkError } from "@/api/errors";
import type { MetricsSummary } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingAnnouncement } from "@/components/ui/states";
import { formatDuration, formatPercent } from "@/domain/format";

export default function MetricsPage() {
  const api = useMemo(() => getOpsApi(), []);

  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadedToken, setLoadedToken] = useState(-1);

  // Derived, not stored: a request is outstanding exactly while the token asked for is ahead
  // of the token that last came back.
  const loading = loadedToken !== reloadToken;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    api
      .getMetrics(controller.signal)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setSummary(loaded);
        setError(null);
        setLoadedToken(reloadToken);
      })
      .catch((cause: unknown) => {
        if (cancelled || (cause instanceof DOMException && cause.name === "AbortError")) {
          return;
        }
        setSummary(null);
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setLoadedToken(reloadToken);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [api, reloadToken]);

  const configError = liveConfigError();
  if (configError) {
    return (
      <ErrorState
        icon={<Settings className="size-12" />}
        title="The console is not configured"
        description={<p>{configError}</p>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display text-ink">How much the agent handles</h1>
          <p className="mt-1 text-caption text-ink-muted">
            Everything on this page comes from a single endpoint,{" "}
            <code className="text-ink">GET /api/metrics/summary</code>.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setReloadToken((token) => token + 1)}
          icon={<RefreshCw aria-hidden="true" className="size-4" />}
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <>
          <LoadingAnnouncement label="Loading the metrics" />
          <MetricsSkeleton />
        </>
      ) : null}

      {!loading && error ? (
        <ErrorState
          icon={<PlugZap className="size-12" />}
          title={error instanceof NetworkError ? "Can't reach the API" : "Metrics could not be loaded"}
          description={
            error instanceof NetworkError ? (
              <p>
                Nothing answered at{" "}
                <code className="rounded-[8px] bg-surface-subtle px-1.5 py-0.5 text-ink">
                  {IS_DEMO ? "the demo client" : API_BASE_URL}
                </code>
                .
              </p>
            ) : (
              <p>{error.message}</p>
            )
          }
          action={
            <Button variant="primary" onClick={() => setReloadToken((token) => token + 1)}>
              Try again
            </Button>
          }
        />
      ) : null}

      {!loading && !error && summary ? <MetricsView summary={summary} /> : null}
    </div>
  );
}

function MetricsView({ summary }: { summary: MetricsSummary }) {
  if (summary.totalTickets === 0) {
    return (
      <EmptyState
        icon={<Inbox className="size-12" />}
        title="No tickets yet"
        description="Nothing has been submitted to the agent, so there is nothing to measure. Post a ticket to POST /api/tickets and this page fills in."
      />
    );
  }

  const {
    totalTickets,
    resolvedAutoCount,
    pendingApprovalCount,
    escalatedCount,
    errorCount,
    autonomousResolutionRate,
    averageResolutionSeconds,
  } = summary;

  /*
   * The endpoint reports four statuses out of the six the domain has — there is no count for
   * RECEIVED or PROCESSING. So the four need not add up to the total, and the difference is
   * exactly the tickets in those two transient states. It is shown as its own segment rather
   * than quietly dropped, because a bar that does not sum to the total is a bar that lies.
   */
  const inProgressCount = Math.max(
    0,
    totalTickets - resolvedAutoCount - pendingApprovalCount - escalatedCount - errorCount,
  );

  const segments = [
    { label: "Resolved without a human", count: resolvedAutoCount, bar: "bg-positive", text: "text-positive" },
    { label: "Waiting for approval", count: pendingApprovalCount, bar: "bg-warning", text: "text-warning" },
    { label: "With a human", count: escalatedCount, bar: "bg-neutral", text: "text-neutral" },
    { label: "Errors", count: errorCount, bar: "bg-negative", text: "text-negative" },
    { label: "Still in progress", count: inProgressCount, bar: "bg-line", text: "text-ink-muted" },
  ].filter((segment) => segment.count > 0);

  return (
    <>
      {/* One number, one screen. Everything else on this page explains this figure. */}
      <Card className="p-6 sm:p-8">
        <p className="label-caps text-ink-muted">Resolved without a human</p>
        <p className="mt-2 text-[4rem] leading-none font-bold tracking-[-2px] tabular-nums text-brand">
          {formatPercent(autonomousResolutionRate)}
        </p>
        <p className="mt-3 text-body text-ink-muted">
          {resolvedAutoCount} of {totalTickets} {totalTickets === 1 ? "ticket" : "tickets"} closed
          by an executed action. The rest either needed a person or are still moving.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="text-title text-ink">Where the tickets ended up</h2>

        <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-surface-subtle">
          {segments.map((segment) => (
            <div
              key={segment.label}
              className={segment.bar}
              style={{ width: `${(segment.count / totalTickets) * 100}%` }}
            />
          ))}
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-body text-ink-muted">{segment.label}</dt>
              <dd className={`text-title tabular-nums ${segment.text}`}>{segment.count}</dd>
            </div>
          ))}
        </dl>

        {inProgressCount > 0 ? (
          <p className="mt-4 text-caption text-ink-muted">
            “Still in progress” is derived: the summary endpoint counts four statuses, and the
            remainder of the total is the tickets that are received or being processed right now.
          </p>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <p className="label-caps text-ink-muted">Average time to resolution</p>
          {averageResolutionSeconds === null ? (
            <>
              <p className="mt-2 text-title text-ink-muted">No resolved tickets yet</p>
              <p className="mt-2 text-caption text-ink-muted">
                Averaged over tickets that have a resolution time. Nothing has one so far, so
                there is no average — not a zero.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-display tabular-nums text-ink">
                {formatDuration(averageResolutionSeconds)}
              </p>
              <p className="mt-2 text-caption text-ink-muted">
                From when the ticket was received to when it was closed, averaged over the{" "}
                {resolvedAutoCount === 1 ? "one ticket" : "tickets"} that have both timestamps.
              </p>
            </>
          )}
        </Card>

        <Card className="p-6">
          <p className="label-caps text-ink-muted">Tickets seen</p>
          <p className="mt-2 text-display tabular-nums text-ink">{totalTickets}</p>
          <p className="mt-2 text-caption text-ink-muted">
            Every ticket the agent has ever been given, all time.
          </p>
        </Card>
      </div>

      {/*
        Saying plainly what is not here. The summary endpoint returns counts and two averages —
        no time series, no per-category split. Drawing a trend line from a single snapshot would
        be inventing data, and inventing data on the one screen whose entire job is reporting
        numbers is the worst possible place to do it.
      */}
      <p className="text-caption text-ink-muted">
        There is no chart over time on this page because the API does not expose one. The summary
        endpoint returns a snapshot: counts by status, one rate, one average. A trend line drawn
        from that would be decoration, not data.
      </p>
    </>
  );
}

function MetricsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <Card className="p-8">
        <div className="animate-pulse">
          <div className="h-3 w-40 rounded-full bg-line" />
          <div className="mt-4 h-16 w-48 rounded-[8px] bg-line" />
          <div className="mt-4 h-3 w-64 rounded-full bg-surface-subtle" />
        </div>
      </Card>
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-5 w-56 rounded-full bg-line" />
          <div className="mt-6 h-3 w-full rounded-full bg-surface-subtle" />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-4 rounded-full bg-surface-subtle" />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
