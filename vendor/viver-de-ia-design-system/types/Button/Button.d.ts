import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import './Button.css';
type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'accent';
type Size = 'sm' | 'md' | 'lg';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    loading?: boolean;
    fullWidth?: boolean;
}
/**
 * Button · primary action component for Viver de IA design system
 *
 * @example
 * <Button variant="primary" iconRight={<ArrowRight />}>
 *   Continuar
 * </Button>
 */
export declare const Button: import("react").ForwardRefExoticComponent<ButtonProps & import("react").RefAttributes<HTMLButtonElement>>;
export {};
