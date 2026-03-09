import { Navigate, useLocation } from "react-router-dom";
import { useAppMode } from "@/hooks/useAppMode";
import { ReactNode } from "react";

/**
 * Route guard that ensures the user is in the correct mode.
 * If they're in "personal" mode but hit a business route, redirect to personal dashboard.
 * If they're in "business" mode but hit a personal route, redirect to business dashboard.
 */
export function BusinessRoute({ children }: { children: ReactNode }) {
  const { isPersonal } = useAppMode();
  if (isPersonal) return <Navigate to="/personal" replace />;
  return <>{children}</>;
}

export function PersonalRoute({ children }: { children: ReactNode }) {
  const { isBusiness } = useAppMode();
  if (isBusiness) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
