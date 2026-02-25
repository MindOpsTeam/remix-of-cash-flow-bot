import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AppMode = "personal" | "business";

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isPersonal: boolean;
  isBusiness: boolean;
}

const AppModeContext = createContext<AppModeContextType>({
  mode: "business",
  setMode: () => {},
  isPersonal: false,
  isBusiness: true,
});

export function AppModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mode, setModeState] = useState<AppMode>(() => {
    return (localStorage.getItem("app_mode") as AppMode) || "business";
  });

  // Load preference from DB on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_preferences")
      .select("preferred_mode")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.preferred_mode) {
          const m = data.preferred_mode as AppMode;
          setModeState(m);
          localStorage.setItem("app_mode", m);
        }
      });
  }, [user]);

  const setMode = useCallback(
    (newMode: AppMode) => {
      setModeState(newMode);
      localStorage.setItem("app_mode", newMode);
      if (user) {
        supabase
          .from("user_preferences")
          .upsert({ user_id: user.id, preferred_mode: newMode }, { onConflict: "user_id" })
          .then(({ error }) => {
            if (error) console.error("Error saving mode preference:", error);
          });
      }
    },
    [user]
  );

  return (
    <AppModeContext.Provider
      value={{ mode, setMode, isPersonal: mode === "personal", isBusiness: mode === "business" }}
    >
      {children}
    </AppModeContext.Provider>
  );
}

export const useAppMode = () => useContext(AppModeContext);
