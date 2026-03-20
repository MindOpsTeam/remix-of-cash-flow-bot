import { useEffect, useCallback, useRef } from "react";

/**
 * Warns the user before leaving the page or closing a dialog with unsaved changes.
 * Returns { markDirty, markClean, isDirty, confirmDiscard }
 */
export function useUnsavedChanges(active = true) {
  const dirtyRef = useRef(false);

  const markDirty = useCallback(() => { dirtyRef.current = true; }, []);
  const markClean = useCallback(() => { dirtyRef.current = false; }, []);

  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);

  const confirmDiscard = useCallback((): boolean => {
    if (!dirtyRef.current) return true;
    return window.confirm("Você tem alterações não salvas. Deseja descartá-las?");
  }, []);

  return { markDirty, markClean, isDirty: () => dirtyRef.current, confirmDiscard };
}
