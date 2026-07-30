import { type HTMLAttributes, type ReactNode } from 'react';
import './Pill.css';
type Variant = 'default' | 'attn' | 'churn' | 'success' | 'live';
type Size = 'sm' | 'md';
export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: Variant;
    size?: Size;
    iconLeft?: ReactNode;
}
/**
 * Pill · canônica do Viver de IA · 11px lowercase nowrap, sem dot decorativo
 *
 * @example
 * <Pill variant="default">em produção</Pill>
 * <Pill variant="attn">requer atenção</Pill>
 * <Pill variant="live">ao vivo</Pill>
 */
export declare const Pill: import("react").ForwardRefExoticComponent<PillProps & import("react").RefAttributes<HTMLSpanElement>>;
export {};
