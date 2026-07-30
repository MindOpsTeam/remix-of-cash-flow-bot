import { type ReactNode } from 'react';
import './Progress.css';
type Tone = 'navy' | 'accent' | 'coral';
type Size = 'sm' | 'md' | 'lg';
export interface ProgressProps {
    value: number;
    label?: ReactNode;
    showValue?: boolean;
    tone?: Tone;
    size?: Size;
    ariaLabel?: string;
    className?: string;
}
/**
 * Progress · barra editorial · ARIA progressbar
 *
 * @example
 * <Progress value={72} label="Onboarding" showValue />
 * <Progress value={40} tone="accent" size="lg" />
 */
export declare function Progress({ value, label, showValue, tone, size, ariaLabel, className, }: ProgressProps): import("react/jsx-runtime").JSX.Element;
export {};
