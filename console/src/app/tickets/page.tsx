"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileSearch, PlugZap, Search, Settings } from "lucide-react";
import { API_BASE_URL, getOpsApi, IS_DEMO, liveConfigError } from "@/api";
import { NetworkError, NotFoundError } from "@/api/errors";
import type { AuditLogEntry, Ticket } from "@/api/types";
import { AuditTimeline } from "@/components/AuditTimeline";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, Field } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingAnnouncement } from "@/components/ui/states";
import { formatAbsoluteTime } from "@/domain/format";
import { parseTicketId, ticketStatusView } from "@/domain/tickets";

export default function TicketsPage() {
  // `useSearchParams` suspends during prerender, and this page is prerendered into static HTML.
  return (
    <Suspense fallback={<LoadingAnnouncement label="Loading" />}>
      <TicketsView />
    </Suspense>
  );
}

interface LoadedTicket {
  ticket: Ticket;
  auditLog: AuditLogEntry[];
}

function TicketsView() {
  const api = useMemo(() => getOpsApi(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const idParam = searchParams.get("id") ?? "";
  const ticketId = parseTicketId(idParam);

  /*
   * One state holding the id it belongs to, rather than separate data/error/loading flags.
   * That makes the three impossible-together combinations unrepresentable, and it makes
   * "loading" derivable: a result tagged with a different id than the one in the URL is a
   * result for a request that has not come back yet.
   */
  const [result, setResult] = useState<{
    id: number;
    data?: LoadedTicket;
    error?: Error;
  } | null>(null);

  const loading = ticketId !== null && result?.id !== ticketId;
  const data = result?.id === ticketId ? (result?.data ?? null) : null;
  const error = result?.id === ticketId ? (result?.error ?? null) : null;

  useEffect(() => {
    if (ticketId === null) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    // Both calls hit the same ticket; issuing them together halves the wait and neither
    // depends on the other's result.
    Promise.all([
      api.getTicket(ticketId, controller.signal),
      api.getAuditLog(ticketId, controller.signal),
    ])
      .then(([ticket, auditLog]) => {
        if (!cancelled) {
          setResult({ id: ticketId, data: { ticket, auditLog } });
        }
      })
      .catch((cause: unknown) => {
        if (cancelled || (cause instanceof DOMException && cause.name === "AbortError")) {
          return;
        }
        setResult({
          id: ticketId,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [api, ticketId]);

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

  const malformedId = idParam.trim().length > 0 && ticketId === null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-display text-ink">Ticket audit trail</h1>
        <p className="mt-1 text-caption text-ink-muted">
          Everything the agent did to a ticket, in order, with its own reasoning attached.
        </p>
      </div>

      {/*
        A lookup box rather than a browsable list, because the API has no endpoint that lists
        tickets — only GET /api/tickets/{id}. Inventing a client-side list would mean either
        guessing at ids or holding a cache the backend does not have. Cards in the queue link
        straight here, which is how an operator actually arrives.
      */}
      <Card className="p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const entered = String(new FormData(event.currentTarget).get("ticketId") ?? "");
            const parsed = parseTicketId(entered);
            // A malformed entry still goes into the URL, so the page can explain what is wrong
            // with it instead of silently doing nothing when the button is pressed.
            router.push(
              entered.trim().length === 0
                ? "/tickets"
                : `/tickets?id=${encodeURIComponent(parsed ?? entered.trim())}`,
            );
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="ticket-id" className="label-caps block text-ink-muted">
              Ticket number
            </label>
            {/*
              Uncontrolled, keyed by the id in the URL. The URL is the source of truth here —
              arriving from a queue card, hitting back, or reloading all set it — and keying the
              field means the browser rebuilds it from that instead of the component copying the
              URL into state and the two drifting.
            */}
            <input
              key={idParam}
              id="ticket-id"
              name="ticketId"
              inputMode="numeric"
              defaultValue={idParam}
              placeholder="e.g. 4"
              aria-invalid={malformedId || undefined}
              aria-describedby={malformedId ? "ticket-id-error" : undefined}
              className={[
                "mt-1 h-12 w-full rounded-[8px] border bg-surface px-4 text-body text-ink",
                "placeholder:text-ink-muted/70 focus:outline-none",
                malformedId ? "border-negative" : "border-line focus:border-brand-bright",
              ].join(" ")}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            icon={<Search aria-hidden="true" className="size-4" />}
          >
            Open
          </Button>
        </form>

        {malformedId ? (
          <p id="ticket-id-error" className="mt-2 text-caption text-negative">
            Ticket numbers are whole numbers, like 4. “{idParam}” is not one.
          </p>
        ) : null}
      </Card>

      {loading ? (
        <>
          <LoadingAnnouncement label="Loading the ticket" />
          <TicketSkeleton />
        </>
      ) : null}

      {!loading && error ? <TicketError error={error} ticketId={ticketId} /> : null}

      {!loading && !error && ticketId === null && !malformedId ? (
        <EmptyState
          icon={<FileSearch className="size-12" />}
          title="Pick a ticket"
          description="Enter a ticket number above, or open one from a card in the approval queue."
        />
      ) : null}

      {!loading && !error && data ? <TicketDetail {...data} /> : null}
    </div>
  );
}

function TicketDetail({ ticket, auditLog }: LoadedTicket) {
  const status = ticketStatusView(ticket.status);

  return (
    <>
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label-caps text-ink-muted">Ticket #{ticket.id}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>

        <h2 className="mt-3 text-title text-ink">{ticket.subject}</h2>
        <p className="mt-1 text-caption text-ink-muted">{status.meaning}</p>

        <p className="mt-6 rounded-[8px] bg-surface-subtle p-4 text-body whitespace-pre-wrap text-ink">
          {ticket.body}
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer">{ticket.customerEmail}</Field>
          <Field label="External id">
            <span className="font-mono text-caption">{ticket.externalId}</span>
          </Field>
          <Field label="Received">{formatAbsoluteTime(ticket.receivedAt)}</Field>
          <Field label="Resolved">
            {ticket.resolvedAt ? (
              formatAbsoluteTime(ticket.resolvedAt)
            ) : (
              <span className="font-normal text-ink-muted">Not resolved</span>
            )}
          </Field>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="text-title text-ink">What happened</h2>
        {auditLog.length === 0 ? (
          <p className="mt-4 text-body text-ink-muted">
            No audit events are recorded for this ticket.
          </p>
        ) : (
          <div className="mt-6">
            <AuditTimeline entries={auditLog} />
          </div>
        )}
      </Card>

      {auditLog.length > 0 ? (
        <details className="rounded-[14px] border border-line bg-surface">
          <summary className="cursor-pointer list-none px-6 py-4 text-body font-semibold text-ink">
            Raw audit log ({auditLog.length}{" "}
            {auditLog.length === 1 ? "event" : "events"})
            <span className="mt-1 block text-caption font-normal text-ink-muted">
              Exactly what GET /api/tickets/{ticket.id}/audit-log returned.
            </span>
          </summary>
          <pre className="overflow-x-auto border-t border-line px-6 py-4 font-mono text-caption text-ink">
            {JSON.stringify(auditLog, null, 2)}
          </pre>
        </details>
      ) : null}
    </>
  );
}

function TicketError({ error, ticketId }: { error: Error; ticketId: number | null }) {
  if (error instanceof NotFoundError) {
    return (
      <ErrorState
        icon={<FileSearch className="size-12" />}
        title={`No ticket ${ticketId ?? ""}`}
        description={
          <p>
            The API has no ticket with this number. Ids are assigned by the database in the order
            tickets arrive, so a low number is not a guarantee that one exists.
          </p>
        }
      />
    );
  }

  return (
    <ErrorState
      icon={<PlugZap className="size-12" />}
      title={error instanceof NetworkError ? "Can't reach the API" : "The ticket could not be loaded"}
      description={
        error instanceof NetworkError ? (
          <p>
            Nothing answered at{" "}
            <code className="rounded-[8px] bg-surface-subtle px-1.5 py-0.5 text-ink">
              {IS_DEMO ? "the demo client" : API_BASE_URL}
            </code>
            . The backend may be down, or running but not allowing requests from this origin.
          </p>
        ) : (
          <p>{error.message}</p>
        )
      }
    />
  );
}

function TicketSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-3 w-24 rounded-full bg-line" />
          <div className="mt-4 h-6 w-2/3 rounded-full bg-line" />
          <div className="mt-6 h-24 rounded-[8px] bg-surface-subtle" />
        </div>
      </Card>
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-5 w-40 rounded-full bg-line" />
          <div className="mt-6 flex flex-col gap-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex gap-4">
                <div className="size-10 shrink-0 rounded-full bg-line" />
                <div className="flex-1 pt-2">
                  <div className="h-3 w-48 rounded-full bg-line" />
                  <div className="mt-2 h-3 w-2/3 rounded-full bg-surface-subtle" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
