"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Inbox, LineChart, Ticket, UserRound } from "lucide-react";
import { useOperator } from "@/hooks/useOperatorName";

const NAV = [
  { href: "/", label: "Queue", icon: Inbox },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/metrics", label: "Metrics", icon: LineChart },
] as const;

/**
 * `trailingSlash` is on so the static export produces real directories for GitHub Pages, which
 * means the live path is "/tickets/" while the link href is "/tickets". Comparing them raw
 * leaves every nav item unhighlighted on every page but the queue.
 */
function isCurrent(pathname: string, href: string): boolean {
  const normalise = (value: string) => value.replace(/\/+$/, "") || "/";
  return normalise(pathname) === normalise(href);
}

export function AppHeader() {
  const pathname = usePathname();
  const { operator, setOperator } = useOperator();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(operator);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[880px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
        <Link href="/" className="text-title text-ink">
          Ops Copilot
          <span className="ml-2 font-normal text-ink-muted">console</span>
        </Link>

        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isCurrent(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "inline-flex h-11 items-center gap-2 rounded-[8px] px-3 text-body font-semibold",
                      "transition-colors duration-[120ms] ease-out",
                      active
                        ? "bg-surface-subtle text-brand"
                        : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
                    ].join(" ")}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/*
          Who is deciding. The backend writes whatever arrives in `reviewedBy` straight into the
          audit log, and its default is the word "operator" for everyone — which makes the log
          useless the moment two people share the queue. This is a label, not a login: there is
          no auth in this system and the console does not pretend there is.
        */}
        <div className="ml-auto">
          {editing ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setOperator(draft);
                setEditing(false);
              }}
              className="flex items-center gap-2"
            >
              <label htmlFor="operator-name" className="sr-only">
                Your name, recorded on every decision
              </label>
              <input
                id="operator-name"
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                  setOperator(draft);
                  setEditing(false);
                }}
                className="h-11 w-40 rounded-[8px] border border-line px-3 text-body text-ink focus:border-brand-bright focus:outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              aria-label={`Signing decisions as ${operator}. Change the name.`}
              onClick={() => {
                setDraft(operator);
                setEditing(true);
              }}
              className="inline-flex h-11 max-w-full items-center gap-2 rounded-[8px] px-3 text-caption text-ink-muted hover:bg-surface-subtle hover:text-ink"
            >
              <UserRound aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">
                Signing decisions as <span className="text-ink">{operator}</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
