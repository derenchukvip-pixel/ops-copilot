"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Clock, X } from "lucide-react";
import type { PendingAction } from "@/api/types";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card, Field } from "./ui/Card";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { formatAbsoluteTime, formatRelativeTime } from "@/domain/format";
import { moneyAtStake } from "@/domain/money";
import { categoryLabel, describeAction, parameterLabel, parameterValue, toolTitle } from "@/domain/tools";

interface PendingActionCardProps {
  action: PendingAction;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  now: Date;
}

/**
 * One decision, one card.
 *
 * The order of the card is the order of the question being asked: who is this about, what is
 * about to happen to them, why does the agent think so, how sure was it — and only then the
 * two buttons. Confidence sits directly above the buttons because it is the last thing that
 * should be in the operator's head when they reach for one.
 */
export function PendingActionCard({
  action,
  busy,
  onApprove,
  onReject,
  now,
}: PendingActionCardProps) {
  const category = categoryLabel(action.category);
  const money = moneyAtStake(action.parameters);
  const parameters = Object.entries(action.parameters);

  return (
    <Card className="p-6" aria-busy={busy || undefined}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="label-caps text-ink-muted">Ticket #{action.ticketId}</span>
        <span className="flex items-center gap-1 text-caption text-ink-muted">
          <Clock aria-hidden="true" className="size-3.5" />
          <time dateTime={action.createdAt} title={formatAbsoluteTime(action.createdAt)}>
            {formatRelativeTime(action.createdAt, now)}
          </time>
        </span>
        {category ? (
          <Badge tone="neutral" className="ml-auto">
            {category}
          </Badge>
        ) : null}
      </div>

      <h2 className="mt-3 text-title text-ink">{action.subject}</h2>
      <p className="mt-1 text-caption text-ink-muted">{action.customerEmail}</p>

      {/* What the agent wants to do. Set apart from the ticket so the two are never confused. */}
      <div className="mt-6 rounded-[8px] bg-surface-subtle p-4">
        <div className="label-caps text-ink-muted">Proposed action</div>
        <p className="mt-1 text-title text-brand">{describeAction(action.toolName, action.parameters)}</p>
        <p className="mt-1 text-caption text-ink-muted">
          {toolTitle(action.toolName)} · requires approval
        </p>

        {parameters.length > 0 ? (
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {parameters.map(([key, value]) => (
              <div key={key}>
                <dt className="label-caps text-ink-muted">{parameterLabel(key)}</dt>
                <dd className="mt-1 text-body font-semibold break-words text-ink">
                  {parameterValue(key, value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {action.reasoning ? (
        <div className="mt-6">
          <div className="label-caps text-ink-muted">Why the agent proposed this</div>
          <blockquote className="mt-2 border-l-2 border-line pl-4 text-body text-ink">
            {action.reasoning}
          </blockquote>
        </div>
      ) : (
        <Field label="Why the agent proposed this" className="mt-6">
          <span className="font-normal text-ink-muted">
            No reasoning was recorded for this ticket.
          </span>
        </Field>
      )}

      <div className="mt-6">
        <ConfidenceMeter confidence={action.confidence} />
      </div>

      {/*
        Approve and reject are pushed to opposite ends rather than sat side by side. A misfire
        on either of these costs someone real money, and a few hundred pixels of separation is
        the cheapest safeguard available.
      */}
      <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="primary"
          onClick={onApprove}
          loading={busy}
          icon={<Check aria-hidden="true" className="size-4" />}
        >
          {money ? "Approve refund" : "Approve"}
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Link
            href={{ pathname: "/tickets", query: { id: action.ticketId } }}
            className="inline-flex items-center gap-1 text-caption font-semibold text-brand-bright hover:underline"
          >
            Open the full ticket
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
          <Button
            variant="danger"
            onClick={onReject}
            disabled={busy}
            icon={<X aria-hidden="true" className="size-4" />}
          >
            Reject
          </Button>
        </div>
      </div>
    </Card>
  );
}
