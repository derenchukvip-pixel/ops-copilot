"use client";

import { useId, useState } from "react";
import type { PendingAction } from "@/api/types";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { describeAction } from "@/domain/tools";

interface RejectDialogProps {
  action: PendingAction | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Rejecting asks for a reason, and the reason is mandatory on the backend too
 * (`RejectActionRequest.reason` is `@NotBlank`) — so a bare "are you sure?" would have to be
 * followed by a second prompt or a rejected request.
 *
 * The reason is not paperwork. It is written to the audit log and it is the entire explanation
 * the next person sees for why this ticket is sitting escalated in their queue.
 */
export function RejectDialog({ action, onCancel, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = useState("");
  const [openedFor, setOpenedFor] = useState<number | null>(null);
  const fieldId = useId();

  // Each opening starts clean: a reason typed for the previous card must never be submitted
  // against this one. Adjusted during render rather than in an effect — this is state derived
  // from a prop changing, and an effect would render the stale text once before clearing it.
  const currentId = action?.id ?? null;
  if (currentId !== openedFor) {
    setOpenedFor(currentId);
    setReason("");
  }

  const trimmed = reason.trim();

  return (
    <Modal
      open={action !== null}
      title="Reject this action?"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Keep it in the queue
          </Button>
          <Button
            variant="danger"
            disabled={trimmed.length === 0}
            onClick={() => onConfirm(trimmed)}
          >
            Reject and escalate
          </Button>
        </>
      }
    >
      {action ? (
        <>
          <p className="text-body text-ink">
            The agent will not run{" "}
            <strong className="font-semibold">
              {describeAction(action.toolName, action.parameters)}
            </strong>
            . Ticket #{action.ticketId} moves to a human instead.
          </p>

          <label htmlFor={fieldId} className="label-caps mt-6 block text-ink-muted">
            Why are you rejecting it?
          </label>
          <textarea
            id={fieldId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            required
            placeholder="The customer never asked for a refund — they are disputing the rate."
            className={[
              "mt-2 w-full rounded-[8px] border border-line bg-surface px-4 py-3",
              "text-body text-ink placeholder:text-ink-muted/70",
              "focus:border-brand-bright focus:outline-none",
            ].join(" ")}
          />
          <p className="mt-2 text-caption text-ink-muted">
            Saved to the audit log and shown to whoever picks the ticket up.
          </p>
        </>
      ) : null}
    </Modal>
  );
}
