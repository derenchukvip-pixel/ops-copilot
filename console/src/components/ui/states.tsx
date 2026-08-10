import type { ReactNode } from "react";
import { Card } from "./Card";

/**
 * Loading, empty and error are three screens the operator will actually see, so they are
 * designed rather than left to whatever falls out of the code.
 */

/**
 * Skeletons, not a spinner. A spinner says "wait"; a skeleton says "wait, and here is the
 * shape of what is coming", which is the difference between a screen that feels stuck and one
 * that feels fast. The blocks below mirror the real card's layout.
 */
export function QueueSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      {[0, 1].map((index) => (
        <Card key={index} className="p-6">
          <div className="animate-pulse">
            <div className="h-3 w-32 rounded-full bg-line" />
            <div className="mt-4 h-6 w-3/4 rounded-full bg-line" />
            <div className="mt-6 h-20 rounded-[8px] bg-surface-subtle" />
            <div className="mt-6 flex gap-3">
              <div className="h-12 w-32 rounded-[14px] bg-line" />
              <div className="h-12 w-28 rounded-[14px] bg-surface-subtle" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function LoadingAnnouncement({ label }: { label: string }) {
  // Skeletons are aria-hidden, so this is the only thing a screen reader hears while waiting.
  return (
    <p role="status" className="sr-only">
      {label}
    </p>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="px-6 py-12 text-center">
      <div aria-hidden="true" className="mx-auto flex size-16 items-center justify-center text-positive">
        {icon}
      </div>
      <h2 className="mt-6 text-title text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-caption text-ink-muted">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Card>
  );
}

interface ErrorStateProps {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}

export function ErrorState({ icon, title, description, action }: ErrorStateProps) {
  return (
    <Card className="border-negative/30 px-6 py-12 text-center">
      <div aria-hidden="true" className="mx-auto flex size-16 items-center justify-center text-negative">
        {icon}
      </div>
      <h2 className="mt-6 text-title text-ink">{title}</h2>
      <div className="mx-auto mt-2 max-w-md text-caption text-ink-muted">{description}</div>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Card>
  );
}
