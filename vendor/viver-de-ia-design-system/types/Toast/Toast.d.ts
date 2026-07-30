import './Toast.css';
type Variant = 'default' | 'success' | 'warning' | 'destructive';
export interface ToastItem {
    id: string;
    variant?: Variant;
    title: string;
    message?: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}
export interface ToastStackProps {
    toasts: ToastItem[];
    onDismiss: (id: string) => void;
    position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
}
/**
 * ToastStack · stack de notificações editoriais com auto-dismiss
 *
 * @example
 * const [toasts, setToasts] = useState<ToastItem[]>([]);
 * const push = (t) => setToasts((p) => [...p, { ...t, id: Date.now().toString() }]);
 *
 * <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />
 */
export declare function ToastStack({ toasts, onDismiss, position }: ToastStackProps): import("react/jsx-runtime").JSX.Element;
export {};
