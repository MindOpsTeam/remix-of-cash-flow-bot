import type { ToastItem } from './Toast';
/**
 * useToasts · hook helper que gerencia o stack de toasts.
 *
 * Vive em arquivo próprio (não no Toast.tsx) para o Fast Refresh
 * funcionar — arquivo de componente exporta só componentes.
 *
 * @example
 * const { toasts, push, dismiss } = useToasts();
 * push({ title: 'Salvo', variant: 'success' });
 * <ToastStack toasts={toasts} onDismiss={dismiss} />
 */
export declare function useToasts(): {
    toasts: ToastItem[];
    push: (toast: Omit<ToastItem, "id">) => string;
    dismiss: (id: string) => void;
    clear: () => void;
};
