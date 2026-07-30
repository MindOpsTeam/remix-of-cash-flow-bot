import { type InputHTMLAttributes, type ReactNode } from 'react';
import './Switch.css';
type Size = 'sm' | 'md';
export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
    label?: ReactNode;
    description?: ReactNode;
    size?: Size;
}
/**
 * Switch · toggle on/off · editorial · ARIA role="switch"
 *
 * @example
 * <Switch label="Notificações por email" defaultChecked />
 * <Switch label="Modo escuro" checked={isDark} onChange={(e) => setDark(e.target.checked)} />
 */
export declare const Switch: import("react").ForwardRefExoticComponent<SwitchProps & import("react").RefAttributes<HTMLInputElement>>;
export {};
