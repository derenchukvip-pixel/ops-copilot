"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "ops-console-operator";

/**
 * The backend defaults `reviewedBy` to the literal string "operator" when the field is omitted,
 * which makes an audit log full of approvals that all look identical. There is no auth in this
 * system — adding a login would mean inventing a security model the backend does not have — so
 * the console asks for a name instead and sends it with every decision.
 *
 * It is a label, not a credential, and the UI says so.
 */
export const DEFAULT_OPERATOR = "operator";

export interface OperatorContextValue {
  operator: string;
  setOperator: (name: string) => void;
}

export const OperatorContext = createContext<OperatorContextValue | null>(null);

/**
 * localStorage as an external store rather than as something copied into state on mount.
 *
 * `useSyncExternalStore` is the right shape for this: the name lives outside React, the server
 * snapshot is the default so prerendered HTML and the first client render agree, and
 * subscribing to `storage` means a name changed in one tab is picked up by the others — which
 * matters when the value ends up in an audit log.
 */
const listeners = new Set<() => void>();

/**
 * Reading `window.localStorage` is not safe to do unguarded: Safari throws on access in some
 * private-browsing and embedded contexts, and a browser configured to block site data reports
 * the property as missing outright. The name is a convenience, so losing it is a degradation
 * — falling back to the default reviewer — and never an error the operator has to see.
 */
function storage(): Storage | null {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Set once storage has failed, so the last name entered survives at least the session. */
let inMemoryName: string | null = null;

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // Fires only for changes made by *other* tabs, hence the local listener set as well.
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot(): string {
  const stored = storage()?.getItem(STORAGE_KEY) ?? inMemoryName;
  return stored && stored.trim().length > 0 ? stored : DEFAULT_OPERATOR;
}

function getServerSnapshot(): string {
  return DEFAULT_OPERATOR;
}

export function useOperatorState(): OperatorContextValue {
  const operator = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setOperator = useCallback((next: string) => {
    const trimmed = next.trim();
    const value = trimmed.length > 0 ? trimmed : DEFAULT_OPERATOR;
    inMemoryName = value;
    try {
      storage()?.setItem(STORAGE_KEY, value);
    } catch {
      // Quota exceeded or writes blocked. The in-memory value above still carries the session.
    }
    for (const listener of listeners) {
      listener();
    }
  }, []);

  return useMemo(() => ({ operator, setOperator }), [operator, setOperator]);
}

export function useOperator(): OperatorContextValue {
  const value = useContext(OperatorContext);
  if (value === null) {
    throw new Error("useOperator must be used inside <OperatorProvider>");
  }
  return value;
}
