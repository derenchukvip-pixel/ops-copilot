"use client";

import type { PendingAction } from "@/api/types";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { amountInWords, formatMoney, moneyAtStake } from "@/domain/money";

interface ApproveMoneyDialogProps {
  action: PendingAction | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * The extra step in front of anything that moves money.
 *
 * The amount appears twice, once as a figure and once spelled out. That is the whole design:
 * `$1,200.00` and `$120.00` are one glyph apart and both look plausible at a glance, whereas
 * "one thousand two hundred" and "one hundred twenty" cannot be confused by someone reading
 * quickly. If the agent extracted the wrong number from the ticket text, this is the screen
 * where a person catches it — after this button the refund executes immediately.
 *
 * Approvals that do not move money get no dialog at all. A confirmation on every action is a
 * confirmation on none of them.
 */
export function ApproveMoneyDialog({ action, onCancel, onConfirm }: ApproveMoneyDialogProps) {
  const money = action ? moneyAtStake(action.parameters) : null;

  return (
    <Modal
      open={action !== null && money !== null}
      title={money ? `Approve a refund of ${formatMoney(money)}?` : "Approve this action?"}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {money ? `Refund ${formatMoney(money)}` : "Approve"}
          </Button>
        </>
      }
    >
      {action && money ? (
        <>
          <p className="text-body text-ink">
            <strong className="font-semibold">{amountInWords(money)}</strong> will be refunded to{" "}
            <strong className="font-semibold">{action.customerEmail}</strong>.
          </p>
          <p className="mt-4 text-body text-ink-muted">
            This runs as soon as you confirm. The console cannot undo it — reversing a refund is
            done in the billing system.
          </p>
        </>
      ) : null}
    </Modal>
  );
}
