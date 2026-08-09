"use client";

import type { ReactNode } from "react";
import { OperatorContext, useOperatorState } from "@/hooks/useOperatorName";

export function OperatorProvider({ children }: { children: ReactNode }) {
  const value = useOperatorState();
  return <OperatorContext.Provider value={value}>{children}</OperatorContext.Provider>;
}
