import { type HTMLAttributes, type ReactNode } from 'react';
import './Card.css';
type Variant = 'default' | 'glass' | 'featured' | 'atmospheric' | 'dark';
export interface CardProps extends HTMLAttributes<HTMLElement> {
    variant?: Variant;
    as?: 'article' | 'div' | 'section';
    hoverable?: boolean;
    noPadding?: boolean;
    children?: ReactNode;
}
/**
 * Card · superfície editorial com glass + atmosphere
 *
 * @example
 * <Card variant="glass">Conteúdo</Card>
 * <Card variant="featured" hoverable>Plano destacado</Card>
 */
export declare const Card: import("react").ForwardRefExoticComponent<CardProps & import("react").RefAttributes<HTMLElement>>;
export {};
