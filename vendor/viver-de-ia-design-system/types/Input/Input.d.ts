import { type InputHTMLAttributes, type ReactNode } from 'react';
import './Input.css';
type Variant = 'default' | 'error' | 'success';
type Size = 'sm' | 'md' | 'lg';
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    variant?: Variant;
    size?: Size;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    label?: string;
    hint?: string;
    error?: string;
}
/**
 * Input · editorial field com optional label, hint, icons
 *
 * @example
 * <Input label="Email" iconLeft={<Mail />} placeholder="seu@email" />
 */
export declare const Input: import("react").ForwardRefExoticComponent<InputProps & import("react").RefAttributes<HTMLInputElement>>;
export {};
