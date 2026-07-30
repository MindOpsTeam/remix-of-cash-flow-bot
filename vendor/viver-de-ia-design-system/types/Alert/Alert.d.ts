import type { ReactNode } from 'react';
import './Alert.css';
type Tone = 'info' | 'attn' | 'danger' | 'success';
export interface AlertProps {
    /** Visual tone (default 'info') */
    tone?: Tone;
    /** Bold lead line */
    title?: ReactNode;
    /** Body content */
    children?: ReactNode;
    /** Optional leading icon (overrides the default per tone) */
    icon?: ReactNode;
    /** Optional inline action at the end (button, link, etc.) */
    action?: ReactNode;
    /** Show a close button (calls `onDismiss`) */
    onDismiss?: () => void;
    /** Visual size · 'compact' for inline / 'banner' for full-bleed (default 'banner') */
    size?: 'compact' | 'banner';
}
/**
 * Alert · persistent inline banner · tone-aware · editorial.
 *
 * Use for state that survives an action (e.g. "Janela de manutenção sex 22h").
 * For ephemeral feedback (e.g. "Salvo"), use Toast instead.
 *
 * @example
 * <Alert tone="attn" title="Próxima janela · domingo 04h"
 *        action={<a href="/status">Ver status</a>}>
 *   Manutenção programada na Nina · pode haver pausa de até 8 minutos.
 * </Alert>
 */
export declare function Alert({ tone, title, children, icon, action, onDismiss, size, }: AlertProps): import("react/jsx-runtime").JSX.Element;
export {};
